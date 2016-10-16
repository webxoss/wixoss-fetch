'use strict'

let gulp         = require('gulp')
let browserify   = require('browserify')
let source       = require('vinyl-source-stream')
let buffer       = require('vinyl-buffer')
let sourcemaps   = require('gulp-sourcemaps')
let del          = require('del')

let path = {
  dest: './dest/',
}

gulp.task('clean', function () {
  return del([path.dest])
})

gulp.task('static', ['clean'], function () {
  return gulp.src('./static/*')
    .pipe(gulp.dest(path.dest))
})

gulp.task('script', ['clean'], function () {
  return browserify('./src/index.js', { debug: true })
    .bundle()
    .pipe(source('matcg_fetch.js'))
    .pipe(buffer())
    .pipe(sourcemaps.init({ loadMaps: true }))
    .pipe(sourcemaps.write(path.dest))
    .pipe(gulp.dest(path.dest))
})

gulp.task('build', ['clean', 'static', 'script'])
