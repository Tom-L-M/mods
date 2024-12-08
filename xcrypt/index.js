const fs = require('node:fs');

const { ArgvParser, isSTDINActive, readStdinAsync } = require('../shared');

/**
 * XOR's a file and a buffer, using the file as primary guide.
 * Writes the result of the xor operations to the outputStream.
 * @param {string} file A valid file path string
 * @param {Buffer} buffer A buffer
 * @param {WritableStream} outputStream A valid writable stream for the output
 */
async function xorFileAndBuffer(file, buffer, outputStream) {
    let ftracker = 0;
    let btracker = 0;
    let fd = fs.openSync(file);

    const CHUNK_SIZE = Math.min(1024 * 1024, fs.fstatSync(fd).size);
    let ouputBuffer = Buffer.alloc(CHUNK_SIZE);
    let fbuffer = Buffer.alloc(CHUNK_SIZE);
    let bbuffer;
    let fbytesread;
    let bbytesread;

    // If there is no data in the file, return nothing (as there is nothing to encrypt)
    if (fs.fstatSync(fd).size === 0) {
        fs.closeSync(fd);
        return;
    }

    // If there is no data in the buffer, return the file with no modifications (as there is no key)
    if (buffer.length === 0) {
        return await new Promise(resolve => {
            const stt = fs.createReadStream(file);
            stt.on('end', () => resolve());
            stt.pipe(outputStream);
            fs.closeSync(fd);
        });
    }

    // Read the first chunk of file
    fbytesread = fs.readSync(fd, fbuffer, 0, CHUNK_SIZE, ftracker);
    ftracker += fbytesread;

    // Read the first chunk of buffer
    bbuffer = buffer.subarray(btracker, btracker + CHUNK_SIZE);
    bbytesread = bbuffer.length;
    btracker += bbytesread;

    while (fbytesread > 0) {
        // If the chunk from buffer is smaller than the chunk from file
        // Restart the buffer position tracker and concat the data
        while (bbytesread < fbytesread) {
            btracker = 0;
            bbuffer = Buffer.concat([
                bbuffer,
                buffer.subarray(
                    btracker,
                    btracker + CHUNK_SIZE - bbuffer.length
                ),
            ]);
            bbytesread = bbuffer.length;
            btracker += bbytesread;
        }

        // XOR the two buffers
        for (let i = 0; i < fbytesread; i++) {
            ouputBuffer[i] = fbuffer[i] ^ bbuffer[i];
        }

        // Write the result to the output file
        await new Promise(resolve => {
            outputStream.write(ouputBuffer, () => {
                ouputBuffer.fill(0);
                resolve();
            });
        });

        // Read the next chunk of the first file
        fbytesread = fs.readSync(fd, fbuffer, 0, CHUNK_SIZE, ftracker);
        ftracker += fbytesread;
        // Read the next chunk of buffer
        bbuffer = buffer.subarray(btracker, btracker + CHUNK_SIZE);
        bbytesread = bbuffer.length;
        btracker += bbytesread;
    }

    fs.closeSync(fd);
}

/**
 * XOR's a buffer and a file, using the buffer as primary guide.
 * Writes the result of the xor operations to the outputStream.
 * @param {Buffer} buffer A buffer
 * @param {string} file A valid file path string
 * @param {WritableStream} outputStream A valid writable stream for the output
 */
async function xorBufferAndFile(buffer, file, outputStream) {
    let ftracker = 0;
    let btracker = 0;
    let fd = fs.openSync(file);

    const CHUNK_SIZE = Math.min(1024 * 1024, buffer.length);
    let tmpBuffer = Buffer.alloc(CHUNK_SIZE);
    let ouputBuffer = Buffer.alloc(CHUNK_SIZE);
    let fbuffer = Buffer.alloc(CHUNK_SIZE);
    let bbuffer;
    let fbytesread;
    let bbytesread;

    // If there is no data in the buffer, return nothing (as there is nothing to encrypt)
    if (buffer.length === 0) {
        fs.closeSync(fd);
        return;
    }
    // If there is no data in the file, return the buffer with no modifications (as there is no key)
    if (fs.fstatSync(fd).size === 0) {
        return await new Promise(resolve => {
            fs.closeSync(fd);
            outputStream.write(buffer, () => resolve);
        });
    }

    // Read the first chunk of buffer
    bbuffer = buffer.subarray(btracker, btracker + CHUNK_SIZE);
    bbytesread = bbuffer.length;
    btracker += bbytesread;

    // Read the first chunk of file
    fbytesread = fs.readSync(fd, fbuffer, 0, CHUNK_SIZE, ftracker);
    ftracker += fbytesread;

    while (bbytesread > 0) {
        // If the chunk from file is smaller than the chunk from buffer
        // Restart the file position tracker and concat the data
        while (fbytesread < bbytesread) {
            fbuffer = fbuffer.subarray(0, fbytesread);
            ftracker = 0;
            tmpBuffer = tmpBuffer.fill(0);
            fbytesread = fs.readSync(fd, tmpBuffer, 0, CHUNK_SIZE, ftracker);
            ftracker += fbytesread;
            fbuffer = Buffer.concat([
                fbuffer,
                tmpBuffer.subarray(0, fbytesread),
            ]);
            fbytesread = fbuffer.length;
        }

        // XOR the two buffers
        for (let i = 0; i < bbytesread; i++) {
            ouputBuffer[i] = bbuffer[i] ^ fbuffer[i];
        }

        // Write the result to the output file
        await new Promise(resolve => {
            outputStream.write(ouputBuffer, () => {
                ouputBuffer.fill(0);
                resolve();
            });
        });

        // Read the next chunk of buffer
        bbuffer = buffer.subarray(btracker, btracker + CHUNK_SIZE);
        bbytesread = bbuffer.length;
        btracker += bbytesread;
        // Read the next chunk of the first file
        fbytesread = fs.readSync(fd, fbuffer, 0, CHUNK_SIZE, ftracker);
        ftracker += fbytesread;
    }

    fs.closeSync(fd);
}

/**
 * XOR's a file1 and a file2, using the file1 as primary guide.
 * Writes the result of the xor operations to the outputStream.
 * @param {string} file1 A valid file path string
 * @param {string} file2 A valid file path string
 * @param {WritableStream} outputStream A valid writable stream for the output
 */
async function xorFiles(file1, file2, outputStream) {
    let tracker1 = 0;
    let tracker2 = 0;
    let fd1 = fs.openSync(file1);
    let fd2 = fs.openSync(file2);

    const CHUNK_SIZE = Math.min(1024 * 1024, fs.fstatSync(fd1).size);
    let tmpBuffer = Buffer.alloc(CHUNK_SIZE);
    let ouputBuffer = Buffer.alloc(CHUNK_SIZE);
    let buffer1 = Buffer.alloc(CHUNK_SIZE);
    let buffer2 = Buffer.alloc(CHUNK_SIZE);
    let bytesread1;
    let bytesread2;

    // If there is no data in the file1, return nothing (as there is nothing to encrypt)
    if (fs.fstatSync(fd1).size === 0) {
        fs.closeSync(fd1);
        fs.closeSync(fd2);
        return;
    }

    // If there is no data in the file2, return the file1 with no modifications (as there is no key)
    if (fs.fstatSync(fd2).size === 0) {
        return await new Promise(resolve => {
            const stt = fs.createReadStream(file1);
            stt.on('end', () => resolve());
            stt.pipe(outputStream);
            fs.closeSync(fd1);
            fs.closeSync(fd2);
        });
    }

    // Read the first chunk of file1
    bytesread1 = fs.readSync(fd1, buffer1, 0, CHUNK_SIZE, tracker1);
    tracker1 += bytesread1;

    // Read the first chunk of file2
    bytesread2 = fs.readSync(fd2, buffer2, 0, CHUNK_SIZE, tracker2);
    tracker2 += bytesread2;

    while (bytesread1 > 0) {
        // If the chunk from buffer is smaller than the chunk from file
        // Restart the buffer position tracker and concat the data
        while (bytesread2 < bytesread1) {
            buffer2 = buffer2.subarray(0, bytesread2);
            tracker2 = 0;
            tmpBuffer = tmpBuffer.fill(0);
            bytesread2 = fs.readSync(fd2, tmpBuffer, 0, CHUNK_SIZE, tracker2);
            tracker2 += bytesread2;
            buffer2 = Buffer.concat([
                buffer2,
                tmpBuffer.subarray(0, bytesread2),
            ]);
            bytesread2 = buffer2.length;
        }

        // XOR the two buffers
        for (let i = 0; i < bytesread1; i++) {
            ouputBuffer[i] = buffer1[i] ^ buffer2[i];
        }

        // Write the result to the output file
        await new Promise(resolve => {
            outputStream.write(ouputBuffer, () => {
                ouputBuffer.fill(0);
                resolve();
            });
        });

        // Read the next chunk of the first file
        bytesread1 = fs.readSync(fd1, buffer1, 0, CHUNK_SIZE, tracker1);
        tracker1 += bytesread1;
        // Read the first chunk of file2
        bytesread2 = fs.readSync(fd2, buffer2, 0, CHUNK_SIZE, tracker2);
        tracker2 += bytesread2;
    }

    fs.closeSync(fd1);
    fs.closeSync(fd2);
}

(async function main() {
    const help = `
    [xcrypt-js]
        A tool for quickly encrypting files with the classic one-time-pad XOR cypher.

    Usage:
        xcrypt [options] <file> <key>
       OR
        <stdin> | xcrypt [options] <key>      # Read the file to encrypt from STDIN 
       OR
        <stdin> | xcrypt [options] -s <file>  # Read the encryption key from STDIN

    Options:
        -h | --help         Prints the help message and quits.
        -v | --version      Prints the version info and quits.
        -s | --stdin-key    Read <key> instead of <file> from STDIN.
                            Has no effect if no data is passed in STDIN.
        -o | --output FILE  The name of the file to output the content to.
                            If one is not specified, content is sent to STDOUT.`;

    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('stdin-key', { alias: 's', allowValue: false });
    parser.option('output', { alias: 'o' });
    const args = parser.parseArgv();

    if (args.version) return console.log(require('./package.json')?.version);
    if (args.help || args._.length === 0) return console.log(help);

    const fromSTDIN = isSTDINActive();
    const stdin = fromSTDIN ? await readStdinAsync() : null;

    // Validate provided parameter <file>
    const file = stdin && !args['stdin-key'] ? stdin : args._[0];
    const fileFromCli = file == args._[0];
    if (!file) {
        return console.log('Error: Missing <file> parameter');
    }
    if (fileFromCli) {
        if (!fs.existsSync(file)) {
            return console.log(
                `Error: Invalid <file> parameter - Could not locate "${file}"`
            );
        }
        const filestat = fs.statSync(file);
        if (!filestat.isFile()) {
            return console.log(
                `Error: Invalid <file> parameter - "${file}" is not a file`
            );
        }
    }

    // Validate provided parameter <key>
    const key =
        stdin && args['stdin-key'] ? stdin : stdin ? args._[0] : args._[1];
    const keyFromCli = key == args._[0] || key == args._[1];
    if (!key) {
        return console.log('Error: Missing <key> parameter');
    }
    if (keyFromCli) {
        if (!fs.existsSync(key)) {
            return console.log(
                `Error: Invalid <key> parameter - Could not locate "${key}"`
            );
        }
        const keystat = fs.statSync(key);
        if (!keystat.isFile()) {
            return console.log(
                `Error: Invalid <key> parameter - "${key}" is not a file`
            );
        }
    }

    const outfile = args.output || null;
    if (outfile && fs.existsSync(args.output)) {
        if (!fs.statSync(args.output).isFile()) {
            return console.log(
                `Error: Cannot write to non-file entity "${args.output}"`
            );
        }
    }

    const outputstream = outfile
        ? fs.createWriteStream(outfile)
        : process.stdout;

    if (Buffer.isBuffer(file)) {
        return await xorBufferAndFile(file, key, outputstream);
    }

    if (Buffer.isBuffer(key)) {
        return xorFileAndBuffer(file, key, outputstream);
    }

    return await xorFiles(file, key, outputstream);
})();
