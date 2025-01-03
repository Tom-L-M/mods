const fs = require('fs');
const path = require('path');
const { ArgvParser } = require('../shared');

function calculateEntropy(file) {
    const data = fs.readFileSync(file);
    const fileSize = data.length;
    const frequency = {};
    for (let i = 0; i < fileSize; i++) {
        const byte = data[i];
        frequency[byte] = frequency[byte] ? frequency[byte] + 1 : 1;
    }
    let entropy = 0;
    for (let byte in frequency) {
        const probability = frequency[byte] / fileSize;
        entropy -= probability * Math.log2(probability);
    }
    return entropy;
}

async function walk(dirpath) {
    return (
        await Promise.all(
            fs.readdirSync(dirpath).map(async file => {
                const filepath = path.join(dirpath, file);
                const stat = fs.statSync(filepath);
                return stat.isDirectory() ? walk(filepath) : filepath;
            })
        )
    )
        .filter(file => file.length)
        .flat(Infinity);
}

(async function main() {
    const help = `
    [entropy-js]
        A tool for calculating Shannon Entropy (in bits/symbol) of a file or sequence of files

    Usage:
        entropy [options] <path>

    Options:
        -h | --help         Prints the help message and quits.
        -v | --version      Prints the version info and quits.

    Info:
        > If a directory path is passed as <path> instead of a file path, 
          the entropy of all files in folders and subfolders will be calculated.`;

    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.argument('path');
    const args = parser.parseArgv();

    if (args.version) return console.log(require('./package.json')?.version);
    if (args.help || !args.path) return console.log(help);

    const fpath = args.path;
    let result;
    try {
        const isDir = fs.statSync(fpath).isDirectory();
        if (isDir) {
            result = (await walk(fpath))
                .map(
                    x =>
                        x +
                        ' :: ' +
                        calculateEntropy(x)
                            .toString()
                            .substring(0, 10)
                            .padEnd(10, '0')
                )
                .flat()
                .join('\n');
        } else {
            result =
                fpath +
                ' :: ' +
                calculateEntropy(fpath)
                    .toString()
                    .substring(0, 10)
                    .padEnd(10, '0');
        }
        result = result.replace(/0000000000/gim, '0.00000000');
        console.log(result.trim());
    } catch (err) {
        console.log('<> Error during entropy calculation -', err.message);
    }
})();
