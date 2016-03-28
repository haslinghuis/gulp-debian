'use strict';
const gutil = require('gulp-util'),
    through = require('through2'),
  titlecase = require('title-case'),
         fs = require('fs-extra'),
      _exec = require('child_process').exec;

function deb(files, pkg, cb) {
    let ctrl = [];
    let mf = [];
    for(let key in pkg) {
        ctrl.push(`${titlecase(key)}: ${pkg[key]}`);
    }
    ctrl.push(' ');
    return cb(null, ctrl);
}

module.exports = function(pkg) {
    let files = [];
    if(pkg._ignore === undefined) {
        pkg._ignore = [];
    }
    return through.obj(function(file, enc, cb) {
        if(file.isStream()) {
            cb(new gutil.PluginError('gulp-debian', 'Streaming not supported.'));
            return;
        }
        let f = file.path.split('/');
        f = f[f.length - 1];
        if(pkg._ignore.indexOf(f) === -1) {
            files.push(file);
        }
        cb(null);

    }, function(cb) {
        deb(files, pkg, function(err, ctrl) {
            if(pkg._verbose === undefined) {
                pkg._verbose = true;
            }
            if(pkg._target === undefined || pkg._out === undefined) {
                cb(new gutil.PluginError('gulp-debian', '_target and/or _out undefined.'));
                return;
            }
            if(err) {
                cb(new gutil.PluginError('gulp-debian', err, {filename: files[0].path}));
                return;
            }
            let out = `${pkg._out}/${pkg.package}_${pkg.version}`;
            let ws = fs.createOutputStream(`${out}/DEBIAN/control`);
            ctrl = ctrl.filter(function(line) {
                if(!/Out|Target|Verbose|Ignore/.test(line))
                    return line;
            })
            ws.write(ctrl.join('\n'));
            files.map(function(f) {
                let t = f.path.split('/');
                t = t[t.length - 1];
                fs.copy(f.path, `${out}/${pkg._target}/${t}`, function(err) {
                    if(err) cb(err);
                    _exec(`dpkg-deb --build ${pkg._out}/${pkg.package}_${pkg.version}`,
                    function(err, stdout, stderr) {
                        if(pkg._verbose && stdout.length > 1) gutil.log(stdout.trim());
                        if(stderr) gutil.log(gutil.colors.red(stderr.trim()));
                        cb(err);
                    });
                });
            });
        });
    });
};
