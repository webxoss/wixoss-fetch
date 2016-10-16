'use strict'

let gulp         = require('gulp')
let browserify   = require('browserify')
let source       = require('vinyl-source-stream')
let buffer       = require('vinyl-buffer')
let sourcemaps   = require('gulp-sourcemaps')
let del          = require('del')

let path = {
  dist: './dist/',
}

gulp.task('clean', function () {
  return del([path.dist])
})

gulp.task('static', ['clean'], function () {
  return gulp.src('./static/*')
    .pipe(gulp.dest(path.dist))
})

gulp.task('script', ['clean'], function () {
  return browserify('./src/index.js', { debug: true })
    .bundle()
    .pipe(source('index.js'))
    .pipe(buffer())
    .pipe(sourcemaps.init({ loadMaps: true }))
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest(path.dist))
})

gulp.task('build', ['clean', 'static', 'script'])
