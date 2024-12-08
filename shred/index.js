const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('node:readline');
const { ArgvParser } = require('../shared');
const WRITE_CHUNK_SIZE = 4 * 1024; // 4 Kb

const help = `
    [shred-js]
        A unix "shred" command line utility in NodeJS.
        Overrides a file with random data in-place and then removes it.
        This allows for complete file exclusion, overriding it.

    Usage:
        node shred [options] [path]...

    Options:        
        -h | --help         Prints the help message and quits.
        -v | --version      Prints the version info and quits.
        -r | --remove       Remove the file after overriding.
        -z | --zerofill     Fills with null bytes instead of random data.
                            This makes the process faster, but less secure.
        -a | --fail-abort   Abort the ret of the operation if it fails to
                            open, read, find, shred, or remove a file.
        -y | --confirm      Skips the confirmation step before shredding.
    
    Info:
        To batch shred items, pass in a directory path instead of a file path
        and all items in the directory will be shredded.
        Or, pass in multiple file paths, to remove multiple files/directories.`;

function refill(buffer) {
    crypto.randomFillSync(buffer);
    return buffer;
}

function confirmAction() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise(resolve =>
        rl.question(
            '\nThis action is irreversible, are you sure? (y/n) ',
            data => (rl.close(), resolve(data.toLowerCase() === 'y'))
        )
    );
}

async function readdirSyncRecursive(dirpath) {
    return (
        await Promise.all(
            fs.readdirSync(dirpath).map(async file => {
                const filepath = path.join(dirpath, file);
                const stat = fs.statSync(filepath);
                return stat.isDirectory()
                    ? readdirSyncRecursive(filepath)
                    : filepath;
            })
        )
    )
        .filter(file => file.length)
        .flat(Infinity);
}

(async function () {
    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('zerofill', { alias: 'z', allowValue: false });
    parser.option('remove', { alias: 'r', allowValue: false });
    parser.option('fail-abort', { alias: 'a', allowValue: false });
    parser.option('confirm', { alias: 'y', allowValue: false });
    const args = parser.parseArgv();

    if (args.version) return console.log(require('./package.json')?.version);
    if (args.help || !args._.length) return console.log(help);

    const remove = Boolean(args.remove);
    const zerofill = Boolean(args.zerofill);
    const abortOnFail = Boolean(args['fail-abort']);
    const autoConfirm = Boolean(args['confirm']);

    const filelist = []; // list of file paths to shred
    const dirlist = []; // list of dir paths to remove

    for (let argfile of args._) {
        if (!fs.existsSync(argfile)) {
            console.log(
                `Error: Invalid file path - Could not find "${argfile}". ` +
                    `${abortOnFail ? 'Aborting.' : 'Skipping.'}`
            );
            if (abortOnFail) return;
            else continue;
        }

        const outerstats = fs.statSync(argfile);
        if (outerstats.isDirectory()) {
            filelist.push(...(await readdirSyncRecursive(argfile)));
            dirlist.push(argfile);
        } else {
            filelist.push(argfile);
        }
    }

    if (filelist.length === 0) {
        return console.log('No valid targets selected. Quitting.');
    }

    if (!autoConfirm) {
        if (dirlist.length > 0) {
            console.log('\nThe following directories will be affected:');
            console.log(' + ' + dirlist.join('\n + '));
        }
        if (filelist.length > 0) {
            console.log('\nThe following files will be affected:');
            console.log(' + ' + filelist.join('\n + '));
        }
        const confirmed = await confirmAction();
        if (!confirmed) return;
    }

    for (let ifile of filelist) {
        let stream,
            stats,
            fsize,
            written = 0;
        try {
            stats = fs.statSync(ifile);
            stream = fs.createWriteStream(ifile, { flags: 'r+' });
            fsize = stats.size;
        } catch {
            console.log(
                `Error: Invalid file path - Could not find "${ifile}". ` +
                    `${abortOnFail ? 'Aborting.' : 'Skipping.'}`
            );
            if (abortOnFail) return;
            else continue;
        }

        // To optimize memory usage, when there is a zerofill operation,
        // simply create a single buffer and reuse it;
        let sharedbuffer;
        if (zerofill) sharedbuffer = Buffer.alloc(WRITE_CHUNK_SIZE, 0);
        else sharedbuffer = Buffer.allocUnsafe(WRITE_CHUNK_SIZE);

        const writeSync = (s, d) => new Promise(r => s.write(d, r));

        for (; written + WRITE_CHUNK_SIZE < fsize; ) {
            if (zerofill) await writeSync(stream, sharedbuffer);
            else await writeSync(stream, refill(sharedbuffer));
            written += WRITE_CHUNK_SIZE;
        }

        if (zerofill) await writeSync(stream, Buffer.alloc(fsize - written, 0));
        else
            await writeSync(
                stream,
                refill(Buffer.allocUnsafe(fsize - written))
            );

        await new Promise(resolve => stream.close(resolve));

        if (remove)
            try {
                fs.rmSync(ifile);
            } catch (err) {
                console.log(
                    `Error: Could not remove "${ifile}" - ${err.message}. ` +
                        `${abortOnFail ? 'Aborting.' : 'Skipping.'}`
                );
                if (abortOnFail) return;
                else continue;
            }
    }

    if (remove) {
        for (let dir of dirlist) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }
})();
