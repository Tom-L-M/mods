const { isSTDINActive, readStdinAsync, ArgvParser } = require('../shared');

function compare(a, b) {
    return a?.toLowerCase() === b?.toLowerCase();
}

const fs = require('fs');

(async function wrapper() {
    const crypto = require('crypto');
    const help = `
    [hasher-js]
        A tool for calculating hash values of files and text.

    Usage:
        node hasher [options] <file|data> 
       OR
        <input> | node hasher [options]

    Options:
        -h | --help         Prints this help message and quit.
        -v | --version      Prints version information and quit.
        -t | --text         Inform that the provided string is data, and not a filename.
        -x | --hash TYPE    Define the hash type to be used.
        -c | --compare HASH Compare the generated hash with the provided hash S.
        -d | --digest TYPE  Digest the generated hash with one of the digest types.
        
    Hash Types:
        sha256 (default), md5, sha1, sha224, sha384, sha512

    Digest Types:
        hex (default), utf8, base64, ascii`;

    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('text', { alias: 't', allowValue: false });
    parser.option('hash', { alias: 'x' });
    parser.option('compare', { alias: 'c' });
    parser.option('digest', { alias: 'd' });
    parser.argument('data');
    const args = parser.parseArgv();

    const fromSTDIN = isSTDINActive();

    if (args.help || (!args.data && !fromSTDIN)) return console.log(help);
    if (args.version) return console.log(require('./package.json')?.version);

    const file = args.data;
    const hashType = args.hash || 'sha256';
    const digest = args.digest || 'hex';
    const isText = args.text;
    const comparison = args.compare;

    let input = fromSTDIN ? await readStdinAsync() : file;

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
