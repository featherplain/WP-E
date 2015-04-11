'use strict';
/*------------------------------------------------------------------------------
 * 1. DEPENDENCIES
------------------------------------------------------------------------------*/
var gulp          = require('gulp'),
  $               = require('gulp-load-plugins')({ pattern: ['gulp-*', 'gulp.*'] }),
  browserify      = require('browserify'),
  browserSync     = require('browser-sync'),
  buffer          = require('vinyl-buffer'),
  fs              = require('fs'),
  merge           = require('merge-stream'),
  path            = require('path'),
  runSequence     = require('run-sequence'),
  source          = require('vinyl-source-stream'),
  argv            = require('yargs').argv
;

/*------------------------------------------------------------------------------
 * 2. FILE DESTINATIONS (RELATIVE TO ASSSETS FOLDER)
------------------------------------------------------------------------------*/
// @param Choose css framework between foundatino and bootstrap
// @param false or virtual host name of local machine such as . Set false to browser-sync start as server mode.
// @param false or Subdomains which must be between 4 and 20 alphanumeric characters.
var opt = {
  'cssBase'      : 'foundation',
  '_s'           : true,
  'proxy'        : 'exp.dev',
  'tunnel'       : false,
  'browser'      : 'google chrome canary'
};
// basic locations
var paths = {
  'root'         : './',
  'srcDir'       : 'src/',
  'srcImg'       : 'src/images/',
  'srcJade'      : 'src/jade/',
  'srcJs'        : 'src/js/',
  'srcJson'      : 'src/json/',
  'srcScss'      : 'src/scss/',
  'destDir'      : 'assets/',
  'destImg'      : 'assets/images/',
  'destCss'      : 'assets/css/',
  'destJs'       : 'assets/js/',
  'htmlDir'      : 'src/html',
  'phpFiles'     : ['*.php', '**/*.php']
};

var rubySassConf = {
  loadPath       : [],
  require        : 'sass-globbing',
  sourcemap      : true
};

function getFolders(dir) {
  return fs.readdirSync(dir).filter(function(file) {
    return fs.statSync(path.join(dir, file)).isDirectory();
  });
}

/*------------------------------------------------------------------------------
 * 3. initializing bower_components
------------------------------------------------------------------------------*/
gulp.task('bower:install', $.shell.task(['bower install']));

gulp.task('install:cssBase', function() {
  if(opt.cssBase) {
    return gulp.src('src/shell/', {read: false})
      .pipe($.shell(['bash src/shell/' + opt.cssBase + '.sh']))
  }
});

gulp.task('install:_s', function() {
  if (opt._s === true) {
    return gulp.src('src/shell/_s.sh', {read: false})
      .pipe($.shell(['echo start copy _s', 'bash src/shell/_s.sh']));
  } else {
    return gulp.src('src/shell/_s.sh', {read: false})
      .pipe($.shell(['echo skipping to install _s']));
  }
});

/*------------------------------------------------------------------------------
 * 4. browser-sync
------------------------------------------------------------------------------*/
gulp.task('browser-sync', function() {
  var args = {};
  if (argv.mode == 'server' ) {
    args.server = { baseDir: paths.root };
    args.startPath = paths.htmlDir;
  } else {
    args.proxy = opt.proxy;
    args.open = 'external';
  }
  if (opt.tunnel != false) args.tunnel = opt.tunnel;
  args.browser = opt.browser;
  browserSync(args);
});

gulp.task('bs-reload', function() {
  browserSync.reload()
});

/*------------------------------------------------------------------------------
 * 5. Jade Tasks
------------------------------------------------------------------------------*/
gulp.task('jade', function() {
  return gulp.src(paths.srcJade + '*.jade')
    .pipe($.data(function(file) { return require('./src/json/setting.json'); }))
    .pipe($.plumber())
    .pipe($.jade({ pretty: true }))
    .pipe(gulp.dest(paths.htmlDir))
    .pipe(browserSync.reload({ stream: true }));
});

/*------------------------------------------------------------------------------
 * 6. js Tasks
------------------------------------------------------------------------------*/
gulp.task('js', function() {
  browserify('./src/js/app.js')
    .bundle()
    .pipe(source('bundle.js'))
    .pipe(buffer())
    .pipe($.uglify())
    .pipe(gulp.dest(paths.destDir + 'js'))
    .pipe(browserSync.reload({ stream: true }));
});

gulp.task('js:hint', function() {
  return gulp.src(paths.srcJs + 'app/*.js')
    .pipe($.jshint())
    .pipe($.jshint.reporter('default'));
});

/*------------------------------------------------------------------------------
 * 7. sass Tasks
------------------------------------------------------------------------------*/
switch(opt.cssBase) {
  case 'foundation':
    rubySassConf.loadPath.push('bower_components/foundation/scss');
    break;
  case 'bootstrap':
    rubySassConf.loadPath.push('bower_components/bootstrap-sass-official/assets/stylesheets');
    break;
}

gulp.task('scss', function() {
    return $.rubySass(paths.srcScss, rubySassConf)
    .on('error', function(err) { console.error('Error!', err.message); })
    .pipe($.autoprefixer({
      browsers: ['> 1%', 'last 2 versions', 'ie 10', 'ie 9'],
      cascade: false
    }))
    .pipe($.csso())
    .pipe($.sourcemaps.write('maps', { includeContent: false }))
    .pipe(gulp.dest(paths.destCss))
    .pipe($.filter('**/*.css'))
    .pipe(browserSync.reload({ stream: true }));
});

/*------------------------------------------------------------------------------
 * 8. Image file tasks
------------------------------------------------------------------------------*/
gulp.task('image-min', function() {
  gulp.src(paths.destImg + 'page/**/*.*')
    .pipe($.imagemin({ optimizationLevel: 3 }))
    .pipe(gulp.dest(paths.destImg + 'page/'))
    .pipe(browserSync.reload({ stream: true }));
});

gulp.task('sprite', function() {
  var spriteData = gulp.src(paths.srcImg + 'sprite/*.png')
  .pipe($.spritesmith({
    imgName: 'sprite.png',
    imgPath: '../images/sprite.png',
    cssName: '__sprite.scss'
  }));
  spriteData.img
    .pipe($.imagemin({ optimizationLevel: 3 }))
    .pipe(gulp.dest(paths.destImg));
  spriteData.css.pipe(gulp.dest(paths.srcScss + 'module'));
});

gulp.task('sprite:inline-svg', function() {
  var folders = getFolders(paths.srcImg + 'sprite-svg');
  var tasks = folders.map(function(folder) {
    return gulp.src(path.join(paths.srcImg + 'sprite-svg', folder, '/*.svg'))
      .pipe($.svgSprite({
        dest: './',
        mode: { symbol: { dest: './' } }
      }))
      .pipe($.rename({
        basename: 'symbol',
        dirname: './',
        prefix: 'sprite-' + folder + '.'
      }))
      .pipe(gulp.dest(paths.destImg));
  });
  return merge(tasks);
});


/*------------------------------------------------------------------------------
 * 9. gulp Tasks
------------------------------------------------------------------------------*/
gulp.task('watch', function() {
  gulp.watch([paths.srcJade + '**/*.jade'],           ['jade']);
  gulp.watch([paths.srcJs   + '**/*.js'],             ['js', 'js:hint']);
  gulp.watch([paths.srcScss + '**/*.scss'],           ['scss']);
  gulp.watch([paths.srcImg  + 'sprite/*.png'],        ['sprite']);
  gulp.watch([paths.srcImg  + 'sprite-svg/**/*.svg'], ['sprite:inline-svg']);
  gulp.watch([paths.phpFiles],                        ['bs-reload']);
});

gulp.task('default', [
  'browser-sync',
  'sprite',
  'watch'
]);

gulp.task('init', function(cb) {
  runSequence('bower:install', ['install:cssBase'], 'install:_s', cb);
});
