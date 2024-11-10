const fs = require('node:fs');

function xorFiles(file1, file2, outputFile) {
    // Open the files
    let fd1 = fs.openSync(file1, 'r');
    let fd2 = fs.openSync(file2, 'r');

    const fdOut = fs.openSync(outputFile, 'w');

    // Init buffers
    const CHUNK_SIZE = Math.min(1024 * 1024, fs.fstatSync(fd2).size); // 1MB
    const buffer1 = Buffer.alloc(CHUNK_SIZE);
    const buffer2 = Buffer.alloc(CHUNK_SIZE);

    // Read the first chunk of each file
    let bytesRead1 = fs.readSync(fd1, buffer1, 0, CHUNK_SIZE, null);
    let bytesRead2 = fs.readSync(fd2, buffer2, 0, CHUNK_SIZE, null);

    // Loop until the end of the first file
    while (bytesRead1 > 0) {
        // XOR the two buffers
        for (let i = 0; i < bytesRead1; i++) {
            buffer1[i] ^= buffer2[i];
        }

        // Write the result to the output file
        fs.writeSync(fdOut, buffer1, 0, bytesRead1);

        // Read the next chunk of the first file
        bytesRead1 = fs.readSync(fd1, buffer1, 0, CHUNK_SIZE, null);

        // If the second file has ended, reset its position to the beginning
        if (bytesRead2 < CHUNK_SIZE) {
            fs.closeSync(fd2);
            fd2 = fs.openSync(file2, 'r');
        }

        // Read the next chunk of the second file
        bytesRead2 = fs.readSync(fd2, buffer2, 0, CHUNK_SIZE, null);
    }

    // Close the files
    fs.closeSync(fd1);
    fs.closeSync(fd2);
    fs.closeSync(fdOut);
}

(async function main() {
    const help = `
    [xcrypt-js]
        A tool for quickly encrypting files with the classic one-time-pad XOR cypher.

    Usage:
        xcrypt [options] <data-file> <key-file> [out-file]

    Options:
        -h | --help         Prints the help message and quits.
        -v | --version      Prints the version info and quits.

    Info:
        > Encrypt/decrypt 'data-file' with data from 'key-file' as key, outputting content to 'out-file'.
        > If 'output-file' is not provided, it defaults to 'data-file' with 'lock' extension appended.
        > If 'output-file' is not provided, and target file already includes a 'lock' extension, it is replaced by 'bin'.

    Theory:
        One-time-pad cyphers, such as XOR, have a perfect-secrecy factor, meaning that 
        if the key size is at least the same size as the data to encrypt, it is virtually 
        impossible to crack it, even with a theorically-infinite computational power.`;

    const args = process.argv.slice(2);
    const arg_file = args[0];
    const arg_skey = args[1];
    const arg_wout = args[2] || arg_file + '.lock';

    if (['-h', '--help', '', undefined].includes(arg_file))
        return console.log(help);
    if (args.includes('-h') || args.includes('--help'))
        return console.log(help);
    if (args.includes('-v') || args.includes('--version'))
        return console.log(require('./package.json')?.version);

    if (args.length < 2 || args.length > 3)
        return console.log(
            `<> Error: Missing parameters - expected [2 or 3], got [${args.length}]`
        );

    if (!fs.existsSync(arg_file))
        return console.log(
            `<> Error: Invalid file passed as parameter [${arg_file}]`
        );
    if (!fs.existsSync(arg_skey))
        return console.log(
            `<> Error: Invalid file passed as parameter [${arg_skey}]`
        );

    const stat1 = fs.statSync(arg_file).size;
    const stat2 = fs.statSync(arg_skey).size;

    if (stat1 > stat2)
        console.log(
            `<> Warning: The provided key file [${stat2} bytes] is smaller than the data file [${stat1} bytes] - This weakens the security level considerably`
        );

    xorFiles(arg_file, arg_skey, arg_wout);
})();
