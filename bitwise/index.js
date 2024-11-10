function printVersion() {
    try {
        console.log(require('./package.json').version);
    } catch (err) {
        console.log(
            `Error: could not read package descriptor - ${err.message}`
        );
    }
}

(function main() {
    const help = `
    [bitwise-js]
        A tool for quickly executing bitwise operations on numbers

    Usage:
        bitwise [options] <operation> [data1] [data2]

    Options:
        -h | --help         Prints the help message and quits.
        -v | --version      Prints the version info and quits.

    Info: 
        > Available operations: 'or', 'and', 'xor', 'not'
        > Defaults for data1 and data2 are both zero (0)`;

    const args = process.argv.slice(2);
    let operation = args[0];
    let data1 = args[1] || 0;
    let data2 = args[2] || 0;

    if (!isNaN(Number(data1))) data1 = Number(data1);
    if (!isNaN(Number(data2))) data2 = Number(data2);
    if (!operation) operation = '--help';

    let res;
    switch (operation) {
        case '--help':
        case '-h':
            res = help;
            break;
        case '--version':
        case '-v':
            return printVersion();
        case 'or':
            res = data1 | data2;
            break;
        case 'and':
            res = data1 & data2;
            break;
        case 'xor':
            res = data1 ^ data2;
            break;
        case 'not':
            res = ~data1;
            break;
        default:
            return console.log(
                'Error: Invalid bitwise operation selected. Use --help for usage.'
            );
    }
    return console.log(res);
})();
