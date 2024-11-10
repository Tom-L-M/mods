// Step 1 <> Select type:
// numeric only => type C
// upper-case alphanumeric => type A
// (upper/lower)-case alphanumeric => type B

// Step 2 <> Get each char bar pattern equivalent

// Step 3 <> Join the bars into a string and repeat it into multiple lines, to match the proper bar height

// Step 4 <> Log it or save it into a file
class Barcode {
    constructor(content) {
        this.content = Barcode.#_adapt(content); // raw string or numeric value received
        this.vrdigit = Barcode.#_vrdigit(content); // get the mod-103 checksum verification digit
        this.pattern = Barcode.#_pattern(content, this.vrdigit); // the barcode binary pattern
        this.encoded = Barcode.#_encode(this.pattern, this.vrdigit); // the first line of the barcode with bar chars
    }

    static #_patternIndex = {
        stop: '1100011101011',
        start: '11010010000',
        B: [
            [' ', '11011001100'],
            ['!', '11001101100'],
            ['"', '11001100110'],
            ['#', '10010011000'],
            ['$', '10010001100'],
            ['%', '10001001100'],
            ['&', '10011001000'],
            ["'", '10011000100'],
            ['(', '10001100100'],
            [')', '11001001000'],
            ['*', '11001000100'],
            ['+', '11000100100'],
            [',', '10110011100'],
            ['-', '10011011100'],
            ['.', '10011001110'],
            ['/', '10111001100'],
            ['0', '10011101100'],
            ['1', '10011100110'],
            ['2', '11001110010'],
            ['3', '11001011100'],
            ['4', '11001001110'],
            ['5', '11011100100'],
            ['6', '11001110100'],
            ['7', '11101101110'],
            ['8', '11101001100'],
            ['9', '11100101100'],
            [':', '11100100110'],
            [';', '11101100100'],
            ['<', '11100110100'],
            ['=', '11100110010'],
            ['>', '11011011000'],
            ['?', '11011000110'],
            ['@', '11000110110'],
            ['A', '10100011000'],
            ['B', '10001011000'],
            ['C', '10001000110'],
            ['D', '10110001000'],
            ['E', '10001101000'],
            ['F', '10001100010'],
            ['G', '11010001000'],
            ['H', '11000101000'],
            ['I', '11000100010'],
            ['J', '10110111000'],
            ['K', '10110001110'],
            ['L', '10001101110'],
            ['M', '10111011000'],
            ['N', '10111000110'],
            ['O', '10001110110'],
            ['P', '11101110110'],
            ['Q', '11010001110'],
            ['R', '11000101110'],
            ['S', '11011101000'],
            ['T', '11011100010'],
            ['U', '11011101110'],
            ['V', '11101011000'],
            ['W', '11101000110'],
            ['X', '11100010110'],
            ['Y', '11101101000'],
            ['Z', '11101100010'],
            ['[', '11100011010'],
            ['\\', '11101111010'],
            [']', '11001000010'],
            ['^', '11110001010'],
            ['_', '10100110000'],
            ['`', '10100001100'],
            ['a', '10010110000'],
            ['b', '10010000110'],
            ['c', '10000101100'],
            ['d', '10000100110'],
            ['e', '10110010000'],
            ['f', '10110000100'],
            ['g', '10110000100'],
            ['h', '10011000010'],
            ['i', '10000110100'],
            ['j', '10000110010'],
            ['k', '11000010010'],
            ['l', '11001010000'],
            ['m', '11110111010'],
            ['n', '11000010100'],
            ['o', '10001111010'],
            ['p', '10100111100'],
            ['q', '10010111100'],
            ['r', '10010011110'],
            ['s', '10111100100'],
            ['t', '10011110100'],
            ['u', '10011110010'],
            ['v', '11110100100'],
            ['w', '11110010100'],
            ['x', '11110010010'],
            ['y', '11011011110'],
            ['z', '11011110110'],
            ['{', '11110110110'],
            ['|', '10101111000'],
            ['}', '10100011110'],
            ['~', '10001011110'],
            ['DEL', '10111101000'],
            ['FNC3', '10111100010'],
            ['FNC2', '11110101000'],
            ['SHIFT', '11110100010'],
            ['CodeC', '10111011110'],
            ['FNC4', '10111101110'],
            ['CodeA', '11101011110'],
            ['FNC1', '11110101110'],
            ['StartA', '11010000100'],
            ['StartB', '11010010000'],
            ['StartC', '11010011100'],
            ['Stop', '11000111010'],
            ['RStop', '11010111000'],
            ['ExtStop', '1100011101011'],
        ],
    };

    static #_adapt(content) {
        return content.toString().trim();
    }

    static #_encode(bincode) {
        bincode.replace(/1/gim, '█').replace(/0/gim, ' ');
    }

    static #_vrdigit(content) {
        let arr = content.split('');
        arr = arr.map((x, y) => {
            for (let i = 0; i < Barcode.#_patternIndex.B.length; i++) {
                if (Barcode.#_patternIndex.B[i][0] === x) {
                    return (
                        Barcode.#_patternIndex.B.indexOf(
                            Barcode.#_patternIndex.B[i]
                        ) *
                        (y + 1)
                    );
                }
            }
        });
        return (arr.reduce((x, y) => x + y) + 104) % 103;
    }

    static #_pattern(content, vrdigit) {
        let arr = content.split('');
        arr = arr.map(x => {
            for (let i = 0; i < Barcode.#_patternIndex.B.length; i++) {
                if (Barcode.#_patternIndex.B[i][0] === x) {
                    return Barcode.#_patternIndex.B[i][1];
                }
            }
        });
        arr = [
            Barcode.#_patternIndex.start,
            ...arr,
            Barcode.#_patternIndex.B[vrdigit][1],
            Barcode.#_patternIndex.stop,
        ];
        return arr.join('');
    }

    render() {
        let bn = this.pattern.replace(/1/gim, '█').replace(/0/gim, ' ');
        bn =
            '\n\n\t' +
            new Array(16)
                .fill(0)
                .map(() => bn)
                .join('\n\t') +
            '\n';
        console.log(bn);
        return 0;
    }
}

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
        [barcode-js]
            Generates barcodes from strings

        Usage:
            barcode [options] [string]

        Options:
            -h | --help         Prints the help message and quits.
            -v | --version      Prints the version info and quits.

        Info:
            Generates a barcode based on the provided string.
            Use --help to access this help screen.`;

    const args = process.argv.slice(2);

    if (
        args[0] == '--help' ||
        args[0] == '-h' ||
        !args[0] ||
        args.length < 1 ||
        args[0] == ''
    ) {
        console.log(help);
    } else if (args.includes('-v') || args.includes('--version')) {
        return printVersion();
    } else {
        new Barcode(args.join(' ')).render();
    }
})();
