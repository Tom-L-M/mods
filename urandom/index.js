/**
 *
 * xoshiro256** implementation in node.js
 *
 *
 * xoshiro is an Xorshift Random Number Generator (RNG) algorithm.
 *
 *
 * More info at: https://en.wikipedia.org/wiki/Xorshift
 */

const isIterable = obj =>
    obj != null && typeof obj[Symbol.iterator] === 'function';

class RNG {
    static #CONSTRUCTOR_TOKEN = Symbol('RNG::DirectConstructorAccessBlocker');
    static #SEED_SIZE = 32;
    static #UINT_SIZE = 8;

    #seed; // Prevent external modification on entropy source (seed)

    constructor(seedbuffer, CONSTRUCTOR_TOKEN) {
        if (CONSTRUCTOR_TOKEN !== RNG.#CONSTRUCTOR_TOKEN)
            throw new Error(
                'Direct constructor access is not allowed. Use RNG.initialize().'
            );
        this.#seed = new BigUint64Array([
            seedbuffer.readBigUInt64BE(RNG.#UINT_SIZE * 0),
            seedbuffer.readBigUInt64BE(RNG.#UINT_SIZE * 1),
            seedbuffer.readBigUInt64BE(RNG.#UINT_SIZE * 2),
            seedbuffer.readBigUInt64BE(RNG.#UINT_SIZE * 3),
        ]);
    }

    get seed() {
        return new BigUint64Array([
            this.#seed[0],
            this.#seed[1],
            this.#seed[2],
            this.#seed[3],
        ]);
    }

    /**
     * Initialize the RNG instance.
     * @param {string|Iterable} seed A Buffer or iterable with length 32 bytes (4 units of 64 bits (8 bytes)).
     * @returns {RNG} An RNG instance initialized with a state and seed.
     */
    static initialize(seed) {
        if (!Buffer.isBuffer(seed) && !isIterable(seed))
            throw new Error(
                'Invalid seed provided, expected an instance of string, Buffer, or Array. Received ' +
                    typeof seed
            );

        const buf = Buffer.from(seed).subarray(0, 32);
        if (buf.length < RNG.#SEED_SIZE)
            throw new Error(
                'Invalid seed provided, expected length to be 32 bytes. Received ' +
                    buf.length +
                    ' bytes'
            );

        return new RNG(buf, RNG.#CONSTRUCTOR_TOKEN);
    }

    /**
     * @param {BigInt} x
     * @param {BigInt} k
     * @returns {BigInt}
     */
    static #rol_UInt64(x, k) {
        return (x << k) | (x >> (64n - k));
    }

    /**
     * Generates a 64-bit BigUInt from a previously initialized state
     * @returns {BigInt} A 64-bit BigInt
     */
    #generateRandomBigInt64() {
        const result = RNG.#rol_UInt64(this.#seed[1] * 5n, 7n) * 9n;
        const t = this.#seed[1] << 17n;
        this.#seed[2] ^= this.#seed[0];
        this.#seed[3] ^= this.#seed[1];
        this.#seed[1] ^= this.#seed[2];
        this.#seed[0] ^= this.#seed[3];
        this.#seed[2] ^= t;
        this.#seed[3] = RNG.#rol_UInt64(this.#seed[3], 45n);
        return result;
    }

    /**
     * Generates a random 64-bit number, in the interval: [0, 2**64].
     * @returns {BigInt}
     */
    randomInt64() {
        return this.#generateRandomBigInt64() % BigInt(Math.pow(2, 64));
    }
    /**
     * Generates a random 64-bit number, in the interval: [0, 2**64].
     * @returns {BigInt}
     */
    int64() {
        return this.randomInt64();
    }

    /**
     * Generates a random 32-bit number from source, in the interval: [0, 2**32].
     * @returns {number}
     */
    randomInt32() {
        return parseInt(
            this.#generateRandomBigInt64() % BigInt(Math.pow(2, 32))
        );
    }
    /**
     * Generates a random 32-bit number from source, in the interval: [0, 2**32].
     * @returns {number}
     */
    int32() {
        return this.randomInt32();
    }

    /**
     * Generates a random 16-bit number from source, in the interval: [0, 65535].
     * @returns {number}
     */
    randomInt16() {
        return parseInt(
            this.#generateRandomBigInt64() % BigInt(Math.pow(2, 16))
        );
    }
    /**
     * Generates a random 16-bit number from source, in the interval: [0, 65535].
     * @returns {number}
     */
    int16() {
        return this.randomInt16();
    }

    /**
     * Generates a random 8-bit number from source, in the interval: [0, 255].
     * @returns {number}
     */
    randomInt8() {
        return parseInt(
            this.#generateRandomBigInt64() % BigInt(Math.pow(2, 8))
        );
    }
    /**
     * Generates a random 8-bit number from source, in the interval: [0, 255].
     * @returns {number}
     */
    int8() {
        return this.randomInt8();
    }
}

// -----------------------------------------------

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
 * parseargs({ "p": "param3" })
 * // creates:
 * {
 *   build: true
 *   param1: true
 *   param2: p2value
 *   param3: 0000
 * }
 */
const parseargs = (mapping = {}, args = process.argv.slice(2)) => {
    let params = {};
    for (let i = 0; i < args.length; i++) {
        if (args[i].startsWith('--'))
            params[args[i].slice(2)] =
                args[i + 1]?.startsWith('-') || !args[i + 1] ? true : args[++i];
        else if (args[i].startsWith('-'))
            params[args[i].slice(1)] =
                args[i + 1]?.startsWith('-') || !args[i + 1] ? true : args[++i];
        else params[args[i]] = true;
    }
    for (let key in mapping) {
        if (params[key]) {
            params[mapping[key]] = params[key];
            delete params[key];
        }
    }
    return params;
};

// -----------------------------------------------

const help = `
    [urandom-js]
        A seeded Random Number Generator (RNG) imitating "/dev/urandom" in Unix.
        Implements the Xoshiro256** algorithm for linear generation.

    Usage:
        urandom <-c N> [OPTIONS]

    Required Arguments:
        -c  | --count  N    Number of bytes/Ints to generate. (Required).

    Options:
        -h  | --help        Display this message.
        -v  | --version     Prints the version info and quits.
        -i1 | --int8        Generates UInt8's as text instead of bytes. Prints one per line.
        -i2 | --int16       Generates UInt16's as text instead of bytes. Prints one per line.
        -i4 | --int32       Generates UInt32's as text instead of bytes. Prints one per line.
        -i8 | --int64       Generates UInt64's as text instead of bytes. Prints one per line.
        -p  | --pad N       Pads numbers with zeros in the left until having length N.
        -d  | --digest S    Digests the UIntN's in a specific base. 
                            (E.g. '8' for octal, '16' for hex, '2' for base-2).
                            (Does not apply if a UInt format is not selected).
        -f  | --prefix      Adds a prefix to a base-digested number.
                            Supported bases are: 2 (0b), 8 (0o), and 16 (0x).
                            Using this flag with other digest base has no effect.
        -u  | --upper-case  Converts the string case of digested numbers containing letters.
                            Has no effect if digest base is 10 or lower (no letters).
                            Has no effect over prefixes, only on the numeric part.`;

function printVersion() {
    try {
        console.log(require('./package.json').version);
    } catch (err) {
        console.log(
            `Error: could not read package descriptor - ${err.message}`
        );
    }
}

(function () {
    const args = parseargs({
        h: 'help',
        v: 'version',
        c: 'count',
        d: 'digest',
        f: 'prefix',
        u: 'upper-case',
        p: 'pad',
        i1: 'int8',
        i2: 'int16',
        i4: 'int32',
        i8: 'int64',
    });

    if (args.help || !args.count || process.argv.length < 3)
        return console.log(help);

    if (args.version) return printVersion();

    const count = parseInt(args.count);
    if (!count || isNaN(count) || count > 65535 || count < 1)
        return console.log(
            `Error: invalid "count" argument provided. Expected a number, between 1 and 65535.`
        );

    const digest = parseInt(args.digest);
    if (args.digest && (!digest || isNaN(digest) || digest > 32 || digest < 2))
        return console.log(
            `Error: invalid "digest" argument provided. Expected a number, between 2 and 32.`
        );

    const padding = parseInt(args.pad);
    if (args.pad && (!padding || isNaN(padding) || padding < 1))
        return console.log(
            `Error: invalid "pad" argument provided. Expected a number, higher than 0.`
        );

    const digestPrefix = args.prefix
        ? digest === 2
            ? '0b'
            : digest === 8
            ? '0o'
            : digest === 16
            ? '0x'
            : ''
        : '';

    const crypto = require('crypto');
    const uppercase = Boolean(args['upper-case']);
    const entropyBytes = crypto.randomBytes(32);
    const generator = RNG.initialize(entropyBytes);

    // We have a problem here: if the entropy bytes selected are repeated,
    // all the generated numbers in a row will be the same
    // as the initial generation point is "position 0".
    // So, to solve it, we add 16 bits of randomness as 2 entropy modifier bytes,
    // and we discard the generated output before reaching 10 * BYTE generations.
    // This slows down generation, but is also extremely safer.
    // This also helps prevent timing attacks agains number generation, as the entropy
    // modifier adds time consumption and is unpredictable.
    const entropyModifierBytes = crypto.randomBytes(2);
    const entropyModifier = entropyModifierBytes.readUint16LE();
    for (let i = 0; i < entropyModifier; i++) generator.int64(); // This is discarded

    let results = [];
    for (let i = 0; i < count; i++) {
        if (args.int64) results.push(generator.int64());
        else if (args.int32) results.push(generator.int32());
        else if (args.int16) results.push(generator.int16());
        else if (args.int8) results.push(generator.int8());
        else results.push(generator.int8());
    }

    // If no textual format is selected, generate as bytes (usually to be piped on terminal)
    if (!args.int64 && !args.int32 && !args.int16 && !args.int8) {
        process.stdout.write(Buffer.from(results));
    } else {
        results = results
            .map(v => {
                let string = v.toString(digest || 10);
                if (uppercase) string = string.toUpperCase();
                if (padding) string = string.padStart(padding, '0');
                return digestPrefix + string;
            })
            .join('\n');
        process.stdout.write(results);
    }
})();
