const fs = require('fs');
const path = require('node:path');

const exeresolve = fname => {
    const [m0, m1] = fname.replaceAll('\\', '/').split('/');
    return __dirname.endsWith(m0)
        ? __dirname + '/' + m1
        : __dirname + '/' + fname;
};

function printVersion() {
    try {
        console.log(require(exeresolve('split/package.json')).version);
    } catch (err) {
        console.log(
            `Error: could not read package descriptor - ${err.message}`
        );
    }
}

const isSTDINActive = () => !process.stdin.isTTY;

/**
 * Parses the CLI arguments (process.argv), dividing the flags into properties of an object.
 * Multi-word params are divided as "param":"value", while sinle-word params becomes: "param":true.
 * Lost values will be ignored*. So 'node example.js 000 --param1' will turn into: { param1:true } and '000' will be ignored.
 *   * Unless they are defined as aliases for other parameters. So, if mapping is defined as { '000':'param0' },
 *     the result will be { param1:true, param0: true } instead of { param1:true }
 * Aliases in 'mapping' do not take priority over regular double-word parameters
 *
 * @since 1.2.14
 *
 * @param {Object} mapping An object mapping the arguments alias. Always take the form of "alias":"originalProperty"
 * @return {Object} An object containing the arguments parsed, and their values
 *
 * @example <caption>  </caption>
 * // called the script with:
 * // node example.js build --param1 --param2 pvalue -p 0000
 * parseArgv({ "p": "param3" })
 * // creates:
 * {
 *   build: true
 *   param1: true
 *   param2: p2value
 *   param3: 0000
 * }
 */
const parseArgv = (mapping = {}, argv = process.argv.slice(2)) => {
    let params = {};
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '-') params['-'] = true;
        else if (argv[i] === '--') params['--'] = true;
        else if (argv[i].startsWith('--'))
            params[argv[i].slice(2)] =
                argv[i + 1]?.startsWith('-') || !argv[i + 1] ? true : argv[++i];
        else if (argv[i].startsWith('-'))
            params[argv[i].slice(1)] =
                argv[i + 1]?.startsWith('-') || !argv[i + 1] ? true : argv[++i];
        else params[argv[i]] = true;
    }
    for (let key in mapping) {
        if (params[key]) {
            params[mapping[key]] = params[key];
            delete params[key];
        }
    }
    return params;
};

function readStdinAsync() {
    return new Promise((resolve, reject) => {
        const stream = process.stdin;
        const chunks = [];

        const onData = chunk => chunks.push(chunk);
        const onEnd = () => quit() && resolve(Buffer.concat(chunks));
        const onError = err => quit() && reject(err);

        const quit = () => {
            stream.removeListener('data', onData);
            stream.removeListener('end', onEnd);
            stream.removeListener('error', onError);
            return true;
        };

        stream.on('data', onData);
        stream.on('end', onEnd);
        stream.on('error', onError);
    });
}

const randomName = (len = 10) =>
    '#'.repeat(len).replace(/[#]/gim, () => Math.random().toString(16)[6]);

const parseUnit = (str = '') => {
    if (str.includes('kb')) {
        return parseInt(str.replace('kb', '')) * 1024;
    } else if (str.includes('mb')) {
        return parseInt(str.replace('mb', '')) * 1024 * 1024;
    } else if (str.includes('gb')) {
        return parseInt(str.replace('gb', '')) * 1024 * 1024 * 1024;
    } else {
        return parseInt(str);
    }
};

const removeExtension = fname => {
    const index = fname.lastIndexOf('.');
    if (index > 0) return fname.slice(0, index);
    return fname;
};

const help = `
    [split-js]

    Split Files:
        split FILE [options]
       OR
        <stdin> | split [options]

    Options:
        -h | --help         Prints the help message and quits.
        -v | --version      Prints the version info and quits.
        -s | --size N       Select a size for splitting.
        -o | --output N     A directory name to place the fragments.
                            Defaults to current directory.

    Info:
        > The default value for splitting blocks is 1kb.
        > Values for splitting may be passed in bytes or with units (kb, mb, gb).

    Example:
        (Split file into blocks of 10mb (1048576 bytes))
          split -f file.txt -s 10mb
        (Split file into default blocks of 1024 bytes)
          split -f file.txt`;

(async function main() {
    const argv = process.argv.slice(2);
    const args = parseArgv({ v: 'version', h: 'help', s: 'size', o: 'output' });
    const DEFAULT_SIZE = 1024 * 1024;
    let file = argv[0];

    if (args.help || (!isSTDINActive() && !file)) return console.log(help);
    if (args.version) return printVersion();

    if (args.size) args.size = parseUnit(args.size);
    else args.size = DEFAULT_SIZE;

    let input, inputSize;

    if (isSTDINActive()) {
        input = await readStdinAsync();
        inputSize = input.length;
        file = undefined;
    } else {
        if (!file || !fs.existsSync(file))
            return console.log('Error: Invalid file path [' + file + ']');

        const filestats = fs.statSync(file);
        inputSize = filestats.size;
    }

    if (args.size >= inputSize) args.size = inputSize;
    if (!args.size || args.size < 1)
        return console.log(`Error: Invalid size for splitting [${args.size}]`);

    let output;
    if (args.output) output = args.output;
    else if (file) output = removeExtension(file) + '_split';
    else output = randomName() + '_split';

    if (!fs.existsSync(output)) fs.mkdirSync(output, { recursive: true });

    // If data was passed through STDIN
    if (!file) {
        const outname = randomName();
        let promises = [];
        let chunk, fname;
        let counter = 0;
        for (let i = 0; i < input.length; i += args.size) {
            chunk = input.subarray(i, i + args.size);
            fname = path.join(
                output,
                outname + '_' + ('' + counter).padStart(5, '0')
            );
            promises.push(fs.promises.writeFile(fname, chunk));
            counter++;
        }
        await Promise.all(promises);
    }

    // file = input file name
    // inputSize = input file size
    // args.size = desired splitting size
    // output = destination directory
    if (file) {
        const readStream = fs.createReadStream(file, {
            highWaterMark: 64 * 1024,
        }); // 64KB buffer for efficiency

        const baseFileName = path.basename(file, path.extname(file));
        const ext = path.extname(file);

        let fileCount = 0;
        let currentFileStream;
        let writtenBytes = 0;

        readStream.on('data', async chunk => {
            let remainingChunk = chunk;

            while (remainingChunk.length > 0) {
                if (!currentFileStream || writtenBytes >= args.size) {
                    if (currentFileStream) {
                        fileCount++;
                        currentFileStream.end(); // End the previous file stream
                        currentFileStream = null;
                    }
                    writtenBytes = 0;
                    const newFileName = path.join(
                        output,
                        `${baseFileName}_${fileCount}${ext}`
                    );
                    currentFileStream = fs.createWriteStream(newFileName);
                }

                const bytesToWrite = Math.min(
                    args.size - writtenBytes,
                    remainingChunk.length
                );
                const chunkToWrite = remainingChunk.slice(0, bytesToWrite);

                await new Promise(resolve =>
                    currentFileStream.write(chunkToWrite, resolve)
                );

                writtenBytes += bytesToWrite;
                remainingChunk = remainingChunk.slice(bytesToWrite); // Reduce the remaining chunk to be processed
            }
        });

        readStream.on('end', () => {
            if (currentFileStream) currentFileStream.end(); // Ensure the last file is closed
            console.log('File split completed.');
        });

        readStream.on('error', err => {
            console.error('Error reading the file:', err);
            if (currentFileStream) currentFileStream.end();
        });
    }
})();
