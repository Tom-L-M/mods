const { parseArgv, isSTDINActive, readStdinAsync } = require('../shared');

function compare(a, b) {
    return a?.toLowerCase() === b?.toLowerCase();
}

const fs = require('fs');

(async function wrapper() {
    const crypto = require('crypto');
    const args = process.argv.slice(2);
    const help = `
    [hasher-js]
        A tool for calculating hash values of files and text.

    Usage:
        node hasher <file|data> [options]
       OR
        <input> | node hasher [options]

    Options:
        -h | --help         Prints this help message and quit.
        -v | --version      Prints version information and quit.
        -t | --text         Inform that the provided string is data, and not a filename.
        -x | --hash         Define the hash type to be used.
        -c | --compare S    Compare the generated hash with the provided hash S.
        -d | --digest S     Digest the generated hash with one of the digest types.
        
    Hash Types:
        sha256 (default), md5, sha1, sha224, sha384, sha512

    Digest Types:
        hex (default), utf8, base64, ascii`;

    const argv = parseArgv({
        h: 'help',
        v: 'version',
        t: 'text',
        c: 'compare',
        d: 'digest',
        x: 'hash',
    });

    const fromSTDIN = isSTDINActive();

    if (argv.help || (args.length < 1 && !fromSTDIN)) return console.log(help);

    if (argv.version) return console.log(require('./package.json')?.version);

    const file = args[0];
    const hashType = argv.hash || 'sha256';
    const comparison = argv.compare;
    const digest = argv.digest || 'hex';
    const isText = argv.text;

    let input = file;

    // If it is called like:   cat somefile | node script.js [flags]
    // E.g. there is input via pipes
    if (fromSTDIN) input = await readStdinAsync();

    if (
        !['md5', 'sha1', 'sha224', 'sha256', 'sha384', 'sha512'].includes(
            hashType
        )
    ) {
        return console.log('ERROR: INVALID HASH SELECTED : ' + hashType);
    }

    if (!['hex', 'utf8', 'base64', 'ascii'].includes(digest))
        return console.log('ERROR: INVALID DIGEST TYPE SELECTED : ' + hashType);

    const hash = crypto.createHash(hashType);

    if (isText || fromSTDIN) {
        let end = hash.update(input);
        end = hash.digest(digest);
        let res =
            end +
            (comparison
                ? ` :: ` + (compare(end, comparison) ? 'EQUAL' : 'NOT EQUAL')
                : '');
        console.log(res);
        return;
    }

    const stream = fs.createReadStream(input);
    stream.on('readable', () => {
        const data = stream.read();
        if (data) hash.update(data);
        else {
            let end = hash.digest(digest);
            let res =
                end +
                (comparison
                    ? ` :: ` +
                      (compare(end, comparison) ? 'EQUAL' : 'NOT EQUAL')
                    : '');
            console.log(res);
        }
    });
    stream.on('error', () => console.log('ERROR: IMPOSSIBLE TO REACH FILE'));
    // NO CODE CAN GO AFTER THIS. The code automatically quits when there is a 'file unreacheable' error above.
})();
