#!/usr/bin/env node
// -*- js -*-

var fs = require('fs'),
    util = require('util'),
    path = require('path'),
    child_process = require('child_process'),
    spawn = child_process.spawn, 
	exec = child_process.exec,
    root_path = process.argv[1];
    
var VERSION = '0.0.0',
    ENCODE = 'utf8',
    PKG_CON,
    PWD = './',
    START_PKG,
    AFFECTED_PKG_REG,
    NEW_VERSION;
    

function _getVersion () {
    var pkgCon = _getPackageJson();
    if (pkgCon) {
        try {
            PKG_CON = JSON.parse(pkgCon);
        } catch (e) {
            util.print(e.message);
            process.exit(1);
        }
        
        VERSION = PKG_CON.version;
    }
    return VERSION;
}

function _getPackageJson() {
    var f1 = './package.json',
        f2 = '../package.json';
    if (fs.existsSync(f1)) {
        return fs.readFileSync(f1, ENCODE).toString();
    } else if (fs.existsSync(f2)) {
        return fs.readFileSync(f2, ENCODE).toString();
    }
}

function _findAffectedPkg() {
    var absP = path.resolve('./', PWD);
    util.print('pvu active in "'+ PWD +'"['+ absP +']\n\n');
    
    var seaPkg = PWD + 'package.json';
    if (!fs.existsSync(seaPkg)) {
        util.error('file [package.json] not found in ['+ absP +']!');
        process.exit(1);
    }
    
    util.print('Start from [' + seaPkg + ']\n');
    
    START_PKG = fs.readFileSync(seaPkg, ENCODE).toString();
    try {
        START_PKG = JSON.parse(START_PKG);
    } catch (e) {
        util.error('invalid [package.json] file' + '\n' + e.message);
    }
    
    NEW_VERSION = START_PKG.version;
    util.print('DEBUG: Package['+START_PKG.name+'] had been updated to $version['+START_PKG.version+']\n');
    
    var outputKeys = Object.keys(START_PKG.output);
    var affectedPkgs = [], ret = [];
    outputKeys.forEach(function (o, i) {
        affectedPkgs.push(START_PKG.name + '/~$version~/' + o.replace(/\.js$/, ''));
        ret.push(new RegExp('(' + START_PKG.name.replace(/\//g, '\\/') + '\\/)([\\d+\\.]+)(\\/' + o.replace(/\.js$/, '') + ')'));
    });
    util.print('DEBUG: Affected Packages \n==\n' + affectedPkgs.join('\n') + '\n==\n');
    
    //console.log('ietao/app/0.1.1/app'.match(ret[0]).length);
    return ret;
}

function isModule(dir) {
	var packageFile = path.join(dir, 'package.json')
		;

	return fs.existsSync(packageFile);
}

function batch(dir) {
    if (isModule(dir)) {
        //todo
        dealAffectedFiles(dir);
    }
    
    fs.readdir(dir, function(err, files) {
        files.forEach(function(file) {
            if (file in ['.', '..', '.git', '.svn']) return;

            var subdir = path.join(dir, file),
                stat = fs.statSync(subdir)
                ;

            if (stat.isDirectory()) {
                batch(subdir);
            }
        });
    });
}

function dealAffectedFiles(dir) {
    //deal with [package.json, entry.js];
    /* if (path.resolve(PWD) == path.resolve(dir)) {
        return;
    } */
    
    //deal package.json
    _dealPackageJson(dir);
    _dealEntryJs(dir);
}

function _dealPackageJson(dir) {
    // 因为是json string，所以可以parse为JSON object后精确的处理 dependencies 的匹配项
    var pkgfile = dir + '/package.json';
    var pkgcon = fs.readFileSync(pkgfile, ENCODE).toString();
    try {
        pkgcon = JSON.parse(pkgcon);
    } catch (e) {};
    
    if (pkgcon.dependencies) {
        //console.log(pkgcon.dependencies)
        var _isMatch = false;
        for (var k in pkgcon.dependencies) {
            var v = pkgcon.dependencies[k];
            AFFECTED_PKG_REG.forEach(function (o, i) {
                var m = v.match(o);
                if (m && m[2]) {
                    if (NEW_VERSION <= m[2]) {
                        util.error('WARN: ['+ pkgfile + ']:[dependencies]:['+v+']\'s version ' + m[1] + ' less than or equal to '+ NEW_VERSION + '\n');
                    }
                    var nv = v.replace(o, '$1'+NEW_VERSION+'$3');
                    pkgcon.dependencies[k] = nv;
                    _isMatch = true;
                    
                    //util.print('['+ pkgfile + ']:[dependencies]:['+v+'] => ' + nv + '\n--\n');
                }
            });
        }
        if (_isMatch) {
            fs.writeFileSync(pkgfile, formatJson(JSON.stringify(pkgcon)), ENCODE);
            util.puts('SUCCESS: Update file -> ' + pkgfile + '\n');
        }
    }
}
function _dealEntryJs(dir) {
    //entry.js 中就只能用正则强制匹配
    var entryFile = dir + '/entry.js';
    if (fs.existsSync(entryFile)) {
        var entryStr = fs.readFileSync(entryFile, ENCODE).toString(),
            _hasMatched = false;
        AFFECTED_PKG_REG.forEach(function (o, i) {
            if (o.test(entryStr)) {
                entryStr = entryStr.replace(o, '$1'+NEW_VERSION+'$3');
                _hasMatched = true;
            }
        });
        
        if (_hasMatched) {
            fs.writeFileSync(entryFile, entryStr, ENCODE);
            util.puts('SUCCESS: Update file -> ' + entryFile + '\n');
        }
    } 
}

function formatJson (val) {
	var retval = '';
	var str = val;
    var pos = 0;
    var strLen = str.length;
	var indentStr = '    ';
    var newLine = '\n';
	var char = '';
	
	for (var i=0; i<strLen; i++) {
		char = str.substring(i,i+1);
		
		if (char == '}' || char == ']') {
			retval = retval + newLine;
			pos = pos - 1;
			
			for (var j=0; j<pos; j++) {
				retval = retval + indentStr;
			}
		}
		
		retval = retval + char;	
		
		if (char == '{' || char == '[' || char == ',') {
			retval = retval + newLine;
			
			if (char == '{' || char == '[') {
				pos = pos + 1;
			}
			
			for (var k=0; k<pos; k++) {
				retval = retval + indentStr;
			}
		}
	}
	
	return retval;
}

function _findProjRoot() {
    //by file .pvu;
    var _start = PWD + '.pvu',
        maxCnt = 10,
        _cnt = 0;
    while(!fs.existsSync(_start) && _cnt < maxCnt) {
        _start = path.resolve(_start, '../');
        _cnt ++;
    }
    
    return fs.existsSync(_start) ? path.dirname(_start) : null;
}

function _begin() {
    AFFECTED_PKG_REG = _findAffectedPkg();
    var projRoot = _findProjRoot();
    
    if (projRoot) {
        util.puts('DEBUG: ProjRoot [' + projRoot + ']');
        batch(projRoot);
    } else {
        util.error('ERROR: Can not find PROJECT ROOT with [.pvu]');
    }
    
    
    
}

//main
function main (args) {
    _getVersion();
    
    if (args && args instanceof Array){
        while (args.length > 0) {
            var v = args.shift();
            switch(v) {
                case '-v':
                case '--version':
                    util.print('version ' + VERSION);
                    process.exit(0);
                default:
                    PWD = v;
                    break;
            }
        }
    }
    
    _begin();
}

//exports
if (require.main === module) {
    main(process.argv.slice(2));
} else {
    module.exports = main;
}
  