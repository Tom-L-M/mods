// toolbox ads <command> <file/dir> [content]
/*
    Commands:
        write       - Writes to an ADSs file stream
        read        - Reads data from an ADSs file stream
        append      - Appends data to an ADSs file stream
        delete      - Removes an ADS file stream by deleting the file and recreating it
        ls          - List all ADS file streams in the specified folder
        lsc         - List all ADS file streams in the specified folder and reads them
        lsr         - List all ADS file streams in the specified folder and below, recursively
        lsrc        - List all ADS file streams in the specified folder and below, recursively, and reads them
*/
const fs = require('node:fs');
const os = require('node:os');
const { ArgvParser } = require('../shared');
const { execSync } = require('node:child_process');

const lsAds = (dir, { read, recursive }) => {
    const tmppath = `C:\\Users\\${
        os.userInfo().username
    }\\AppData\\Local\\Temp\\EFSVRESGRGESF.txt`;
    try {
        let acc = [];
        let lines;
        if (recursive) {
            lines = execSync(
                `dir ${dir} /a /s /r | findstr ":$DATA Pasta Directory" > ${tmppath}`
            );
            lines = fs
                .readFileSync(tmppath, 'utf8')
                .toString('utf-8')
                .split('\n');
            lines = lines.map(x => x.trim()).filter(x => !!x);
        } else {
            lines = execSync(
                `dir ${dir} /a /r | findstr ":$DATA Pasta Directory"`
            )
                .toString('utf-8')
                .split('\n');
            lines = lines.map(x => x.trim()).filter(x => !!x);
        }

        let lastdir = '';
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            let nextline = lines[i + 1];
            if (
                nextline &&
                !nextline.includes(':$DATA') &&
                !line.includes(':$DATA')
            ) {
                continue;
            }
            if (!line.includes(':$DATA')) {
                lastdir = line
                    .trim()
                    .replace('Pasta de ', '')
                    .replace('Directory of ', '');
                continue;
            }
            let [size, ads] = line.trim().split(' ');
            let [hostfile, adsfile] = ads.trim().split(':');
            let result;
            try {
                if (read)
                    result =
                        '[' +
                        fs
                            .readFileSync(
                                lastdir +
                                    '\\' +
                                    hostfile +
                                    ':' +
                                    adsfile +
                                    ':$DATA',
                                'utf-8'
                            )
                            .trim()
                            .split('\n')
                            .join(' \\n ') +
                        ']';
                else result = '';
            } catch {
                result = 'ERR::ECREAD';
            }
            acc.push(
                `  ${lastdir}\\${hostfile}    ${hostfile}    [:${adsfile}]    (${size})    ${result}`
            );
        }
        if (fs.existsSync(tmppath)) fs.rmSync(tmppath);
        return console.log(acc.join('\n'));
    } catch (err) {
        console.log(err);
        console.log('Error: Operation not permitted - SCANDIR::' + dir);
    }
};

function writeADS(target, content) {
    try {
        fs.writeFileSync(target, content);
        console.log('<> Success');
    } catch (err) {
        console.log(err.message);
    }
    return;
}

function readADS(target) {
    let data;
    try {
        data = fs.readFileSync(target, 'utf-8');
        console.log(data);
    } catch (err) {
        console.log(err.message);
    }
    return;
}

function appendADS(target, content) {
    try {
        fs.appendFileSync(target, content);
        console.log('<> Success');
    } catch (err) {
        console.log(err.message);
    }
    return;
}

function deleteADS(target) {
    try {
        fs.rmSync(target);
        console.log('<> Success');
    } catch (err) {
        console.log(err.message);
    }
    return;
}

(function () {
    const HELP = `
    [altfs-js]
        A tool for manipulating Alternate Data Streams (ADSs) in WindowsOS
    
    > Usage:
        altfs [options] <command> [file] [content]

    > Options:
        -h | --help         Prints the help message and quits.
        -v | --version      Prints the version info and quits.

    > Commands:
        write       - Writes to an ADS or file
        read        - Reads data from an ADS or file
        append      - Appends data to an ADS or file
        delete      - Removes an ADS or file
        ls          - List all ADS in a folder
        lsc         - List all ADS in a folder and reads them
        lsr         - List all ADS in a folder and subfolders
        lsrc        - List all ADS in a folder and subfolders, and reads them
        
    > Examples:
        Read a Zone Identifier ADS in a downloaded file:
            altfs read somefile.txt:Zone.Identifier`;

    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.argument('command');
    parser.argument('file');
    parser.argument('content');
    const args = parser.parseArgv();

    if (args.version) return console.log(require('./package.json')?.version);
    if (args.help || !args.command) return console.log(HELP);

    const command = args.command;
    const target = args.file || '.';
    const content = args.content;

    switch (command) {
        case 'write':
            writeADS(target, content);
            break;
        case 'read':
            readADS(target);
            break;
        case 'append':
            appendADS(target, content);
            break;
        case 'delete':
            deleteADS(target);
            break;
        case 'ls':
            lsAds(target, { read: false, recursive: false });
            break;
        case 'lsc':
            lsAds(target, { read: true, recursive: false });
            break;
        case 'lsr':
            lsAds(target, { read: false, recursive: true });
            break;
        case 'lsrc':
            lsAds(target, { read: true, recursive: true });
            break;
        default:
            console.log('<> ERROR: Invalid command [' + command + ']');
    }
})();
