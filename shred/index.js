const crypto = require('crypto');
const fs = require('fs');
const { parseArgv } = require('../shared');

const help = `
    [shred-js]
        A unix "shred" command line utility in NodeJS.
        Overrides a file with random data in-place and then removes it.
        This allows for complete file exclusion, overriding it.

    Usage:
        node shred [file] [options]

    Options:        
        -h | --help         Prints the help message and quits.
        -v | --version      Prints the version info and quits.
        -r | --remove       Remove the file after overriding.
        -z | --zerofill     Fills with null bytes instead of random data.
                            This makes the process faster, but less secure.`;

function refill(buffer) {
    crypto.randomFillSync(buffer);
    return buffer;
}

const WRITE_CHUNK_SIZE = 4 * 1024; // 4 Kb

(async function () {
    const file = process.argv[2];
    const opts = { h: 'help', v: 'version', z: 'zerofill', r: 'remove' };
    const args = parseArgv(opts);

    if (args.help || !file) return console.log(help);
    if (args.version) return console.log(require('./package.json')?.version);

    let remove = args['remove'];
    let zerofill = args.zerofill;

    let stream,
        stats,
        fsize,
        written = 0;
    try {
        stats = fs.statSync(file);
        stream = fs.createWriteStream(file);
        fsize = stats.size;
    } catch {
        return console.log(`Error: could not find file - ${file}`);
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
    else await writeSync(stream, refill(Buffer.allocUnsafe(fsize - written)));

    await new Promise(resolve => stream.close(resolve));

    if (remove) fs.rmSync(file);
})();
