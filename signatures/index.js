function getSignature(stream, signatures, dumpall) {
    let bytes = stream.toString('hex').toUpperCase();
    let results = [];
    for (let sign in signatures) {
        if (bytes.startsWith(sign.split(' ').join(''))) {
            results.push({
                signature: signatures[sign].signature,
                type: signatures[sign].extension,
                offset: '0x' + ''.padStart(8, '0'),
                description:
                    signatures[sign]?.description || '< no description >',
            });
        }
    }
    if (results.length === 0) {
        results.push({
            signature: '??',
            type: 'txt | plain | other',
            offset: '0x' + ''.padStart(8, '0'),
            description: '< unknown >',
        });
    }

    if (dumpall) {
        for (let sign in signatures) {
            let index = bytes.indexOf(sign);
            let offset =
                '0x' + Buffer.from([index]).toString('hex').padStart(8, '0');
            if (index > 0) {
                let obj = {
                    signature: signatures[sign].signature,
                    type: signatures[sign].extension,
                    offset: offset,
                    description:
                        signatures[sign]?.description || '< no description >',
                };
                results.push(obj);
            }
        }
    }
    results = results
        .map(
            x =>
                `${x.offset} - [ ${x.signature} ] - [ ${x.type} ] - ${x.description}`
        )
        .join('\n');
    return results;
}

const fs = require('fs');
const signatures = require('./signatures.json');
const { ArgvParser, isStdinActive, readStdin } = require('../shared');

const help = `
    [signatures-js]
        A tool for extracting file signatures (magic numbers)

    Usage:
        node signatures [options] <file>
      OR
        <stdin> | node signatures [options] 

    Options:
        -h | --help             Prints the help message and quits.
        -v | --version          Prints the version info and quits.
        -a | --all              Prints all signature markers, instead
                                of just the first one.`;

(async function () {
    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('all', { alias: 'a', allowValue: false });
    parser.argument('file');
    const args = parser.parseArgv();

    const fromSTDIN = isStdinActive();
    if (args.version) return console.log(require('./package.json')?.version);
    if (args.help || (!fromSTDIN && !args.file)) return console.log(help);

    try {
        let data;
        if (fromSTDIN) {
            data = await readStdin();
        } else {
            // If not trying to get all extensions,
            // then read only the first 150 bytes instead of entire file
            if (!args.all) {
                const buff = Buffer.alloc(150);
                const fd = fs.openSync(args.file);
                fs.readSync(fd, buff, 0, buff.length, 0);
                data = buff;
            } else {
                data = fs.readFileSync(args.file);
            }
        }
        const dump = getSignature(data, signatures, args.all);
        console.log(dump);
    } catch (err) {
        console.log('ERROR: File Not Found - Impossible to complete dump');
        console.log('Message:', err.message);
    }
})();
