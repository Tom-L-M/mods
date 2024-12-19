const fs = require('fs');
const path = require('node:path');
const { isSTDINActive, readStdinAsync, ArgvParser } = require('../shared');

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
        split [options] file
       OR
        <stdin> | split [options]

    Options:
        -h | --help         Prints the help message and quits.
        -v | --version      Prints the version info and quits.
        -s | --size N       Select a size for splitting.
        -q | --quiet        Prevents printing of count of generated files.
        -o | --output N     A directory name to place the fragments.
                            Defaults to current directory.

    Info:
        > Prints the number of files generated (unless '-q' is used).
        > The default value for splitting blocks is 1kb.
        > Values for splitting may be passed in bytes or with units (kb, mb, gb).

    Example:
        > Split file into blocks of 10mb (1048576 bytes)
          split -f file.txt -s 10mb
        > Split file into default blocks of 1024 bytes
          split -f file.txt`;

(async function main() {
    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('size', { alias: 's' });
    parser.option('quiet', { alias: 'q', allowValue: false });
    parser.option('output', { alias: 'o' });
    parser.argument('file');
    const args = parser.parseArgv();

    const DEFAULT_SIZE = 1024 * 1024;
    let file = args.file;

    if (args.version) return console.log(require('./package.json')?.version);
    if (args.help || (!isSTDINActive() && !file)) return console.log(help);

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

    if (inputSize <= 1)
        return console.log(`Error: Invalid input file size [${inputSize}]`);

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
        if (!args.quiet) console.log(counter);
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
        let totalWritten = 0;

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
                totalWritten += bytesToWrite;
                remainingChunk = remainingChunk.slice(bytesToWrite); // Reduce the remaining chunk to be processed
            }

            // If all data was consumed, print total numer of files
            if (totalWritten === inputSize)
                if (!args.quiet) console.log(fileCount + 1);
        });

        readStream.on('end', () => {
            if (currentFileStream) currentFileStream.end(); // Ensure the last file is closed
        });

        readStream.on('error', err => {
            console.log('Error: Could not read file -', err.message);
            if (currentFileStream) currentFileStream.end();
        });
    }
})();
