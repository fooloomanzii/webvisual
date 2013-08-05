@echo off

set version="%1"

node -e "var fs=require('fs'),path='./src/package.json',pack=require(path),version="%version%";function isVersionNumber(a){return(/^\d{1,2}\.\d{1,2}\.\d{1,2}[a-z]?$/.test(a))}if(!isVersionNumber(version)){console.error('No valid version number.');process.exit(1)};pack.version=version;fs.writeFileSync(path,JSON.stringify(pack,null,'\t'));console.log('Version number '+version+' was written into '+path+'.');"