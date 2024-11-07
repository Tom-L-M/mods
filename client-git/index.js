#! /usr/bin/env node

let http = require('https');
let fs = require('fs');
const { exec } = require('child_process');

const gitclone = function (repo = '', branch = 'main', newname = null) {
    let mask = `https://codeload.github.com/${repo}/zip/${branch}`;
    let dest = (repo + '.zip')
        .replace(/\//gim, '@@@') //destination zip file
        .replace(/\*/gim, '_')
        .replace(/\?/gim, '_')
        .replace(/\\/gim, '_')
        .replace(/-/gim, '_')
        .replace(/:/gim, '_')
        .replace(/;/gim, '_')
        .replace(/'/gim, '_')
        .replace(/"/gim, '_')
        .replace(/</gim, '_')
        .replace(/>/gim, '_');
    let extractedName =
        dest.substring(dest.lastIndexOf('@@@') + 3, dest.lastIndexOf('.zip')) +
        '-' +
        branch;

    http.get(mask, function (response) {
        if (response.statusCode !== 200) {
            throw 'Repository Unreacheable: ' + repo;
        } else {
            console.log(
                `\n\x1b[32m    [*]  Pulled \x1b[0m\x1b[35m@${repo} \x1b[0m\x1b[32m[\x1b[0m\x1b[35m${branch}\x1b[0m\x1b[32m] successfully \x1b[0m`
            );
        }
        let file = fs.createWriteStream(dest); // file writing stream
        response.pipe(file);
        file.on('finish', () => {
            file.close(() => {});
            exec(`tar -xf %CD%\\${dest}`, err => {
                if (err) throw err;

                if (newname) {
                    exec(`rd /S /Q ${newname}`);
                    console.log(
                        '\n\x1b[32m    [*]  Extracted \x1b[0m\x1b[35mrepo to ' +
                            extractedName +
                            '\x1b[0m'
                    );
                    exec(`rename ${extractedName} ${newname}`);
                    console.log(
                        '\n\x1b[32m    [*]  Renamed \x1b[0m\x1b[35m' +
                            extractedName +
                            '\x1b[0m\x1b[32m to \x1b[35m' +
                            newname +
                            '\x1b[0m'
                    );
                }
                exec(`del ${dest}`);

                console.log(
                    `\n\x1b[32m    [*]  Cloned \x1b[0m\x1b[35m@${repo}\x1b[0m \x1b[32m[\x1b[0m\x1b[35m${branch}\x1b[0m\x1b[32m] successfully \x1b[0m`
                );
            });
        }); // close() is async, call cb after close completes.

        // Handle errors
        // Delete the file async. (But we don't check the result)
    }).on('error', () => fs.unlink(dest));
};

const _require = file => {
    const fname = process.env.MODULE_NAME + '/' + file;
    const fdirname = __dirname.replaceAll('\\', '/');
    const [m0, m1] = fname.replaceAll('\\', '/').split('/');
    const final = fdirname.endsWith(m0)
        ? fdirname + '/' + m1
        : fdirname + '/' + fname;
    return require(final);
};

function printVersion() {
    try {
        console.log(_require('package.json').version);
    } catch (err) {
        console.log(
            `Error: could not read package descriptor - ${err.message}`
        );
    }
}

(function main() {
    const args = process.argv.slice(2);
    const help = `
    [client-git-js]
        Downloads and imports repositories from GitHub

    Usage:
        client-git <LINK> [options]

    Options:
        -h | --help         Prints the help message and quits.
        -v | --version      Prints the version info and quits.
        -b | --branch       Pull a specific branch (default: main).
        -d | --dirname      Rename the github pulled directory.

    Info:
        > <LINK> can come in two formats:
            > Usual full git URL: 
                https://github.com/user/repo.git
                
            > Shortened user/repo notation:
                [<username>/<repository>]
    
        Ex: pull the 'Canicula' repo from branch 'alt' , and rename the folder
            client-git Tom-L-M/Canicula -b alt -r newly-pulled-dir
            
        Ex: pull the same repo from before, but with an HTTPS link:
            client-git https://github.com/Tom-L-M/Canicula.git -b alt`;

    if (args.length == 0 || args.includes('-h') || args.includes('--help')) {
        return console.log(help);
    } else if (args.includes('-v') || args.includes('--version')) {
        return printVersion();
    } else {
        let repo = args[0];
        let branch = undefined;
        let newname = undefined;
        let index = 0;

        if (args.includes('-b')) {
            index = args.indexOf('-b') + 1;
            branch = args.slice(index, index + 1)[0];
        }

        if (args.includes('-r')) {
            index = args.indexOf('-r') + 1;
            newname = args.slice(index, index + 1)[0];
        }

        if (!repo) return console.log(help);
        if (repo.startsWith('https://')) {
            repo = repo.replace('https://github.com/', '').replace('.git', '');
        }

        gitclone(repo, branch, newname);
    }

    return;
})();
