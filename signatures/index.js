const help = `
    [signatures-js]
        A tool for extracting file signatures (magic numbers)

    Usage:
        signatures <file> [-a|--all] [-v|--version] [-h|--help]

    Info:
        > Setting -a or --all, forces the program to output all magic numbers found, 
          including the ambiguous ones in the middle of bytecode.`;

const fs = require('fs');
const args = process.argv.slice(2).map(x => x.toLowerCase());

const file = (args[0] || '').toLowerCase();
const dumpall = args.includes('--all') || args.includes('-a');
const signatures = require('./signatures.json');
// const signatures = JSON.parse(fs.readFileSync('./signatures/signatures.json', 'utf-8'));
// Remember: When using it as a compiled package, the execution 'chdir' is one level upper

function getSignature(stream) {
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

(function () {
    if (args.includes('-v') || args.includes('--version')) {
        return console.log(require('./package.json')?.version);
    }

    if (args.includes('-h') || args.includes('--help')) {
        return console.log(help);
    }

    if (file === '--help' || !file) return console.log(help);
    try {
        let stream = fs.readFileSync(file);
        let dump = getSignature(stream);
        console.log(dump);
    } catch (err) {
        console.log('ERROR: File Not Found | Impossible to complete dump');
        console.log(err.message);
    }
    return;
})();
