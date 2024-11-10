const crypto = require('crypto');
const fs = require('fs');

const generate = (mod = 4096, pass = undefined) => {
    const pair_config = { modulusLength: mod };
    const public_config = { type: 'spki', format: 'pem' };
    const private_config = { type: 'pkcs8', format: 'pem' };

    if (pass) {
        private_config.cipher = 'aes-256-cbc';
        private_config.passphrase = pass;
    }

    const { publicKey, privateKey } = crypto.generateKeyPairSync(
        'rsa',
        pair_config
    );
    const exportedPublicKeyBuffer = publicKey.export(public_config);
    const exportedPrivateKeyBuffer = privateKey.export(private_config);
    return {
        public: exportedPublicKeyBuffer,
        private: exportedPrivateKeyBuffer,
    };
};

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
    const WARNS = {
        'fatal-invalid-writing': 'Error: Invalid writing\n',
        'fatal-invalid-generate': 'Error: Invalid generation scheme\n',
        'fatal-invalid-mod-size': 'Error: Invalid mod size provided',
    };

    const help = `
    [rsa-keypair-js]
        A tool for generating secure RSA key pairs

    Usage:
        rsa-keypair [options]

    Options:
        -h | --help         Prints the help message and quits.
        -v | --version      Prints the version info and quits.
        -s | --save         Save keys on disk.
        -o | --out          Print keys to console.
        -p | --pass X       Encrypt the key with a passphrase (uses AES-256)
        -m | --mod X        Change module length:   4096 (default), 2048, 1024

    Info:
        > Save name for keys is: './TIME-TYPE.pem'
        > Ex:   1696606199203-public.pem
                1696606199203-private.pem`;

    const args = process.argv.slice(2);

    if (args[0] == '--help' || args[0] == '-h' || args.length < 1) {
        return console.log(help);
    }

    let res;
    let date = Date.now();
    let priv = `./${date}-private.pem`;
    let publ = `./${date}-public.pem`;
    let pass = undefined;
    let mods = 4096;
    let save = false;
    let out = false;

    // Check if there is a 'save' switch:
    if (args.includes('-s') || args.includes('--save')) {
        save = true;
    }

    // Check if there is an 'out' switch:
    if (args.includes('-o') || args.includes('--out')) {
        out = true;
    }

    if (args.includes('-h') || args.includes('--help'))
        return console.log(help);

    if (args.includes('-v') || args.includes('--version'))
        return printVersion();

    if (!save && !out) return console.log(help);

    // Check if there is a passphrase:
    if (args.includes('-p')) {
        pass = args[args.indexOf('-p') + 1];
    } else if (args.includes('--pass')) {
        pass = args[args.indexOf('--pass') + 1];
    }

    // Check if modsize is valid:
    if (args.includes('-m')) {
        mods = Number(args[args.indexOf('-m') + 1]);
    } else if (args.includes('--mod')) {
        mods = Number(args[args.indexOf('--mod') + 1]);
    }
    if (!['4096', '2048', '1024'].includes('' + mods)) {
        return console.log(WARNS['fatal-invalid-mod-size']);
    }

    // Generate keys:
    try {
        res = generate(mods, pass);
    } catch (err) {
        return console.log(WARNS['fatal-invalid-generate'], err.message);
    }

    if (save) {
        // Export keys:
        try {
            fs.writeFileSync(publ, res.public, { encoding: 'utf-8' });
            fs.writeFileSync(priv, res.private, { encoding: 'utf-8' });
        } catch (err) {
            return console.log(WARNS['fatal-invalid-writing'], err.message);
        }
    }
    if (out) {
        console.log();
        console.log(res.public);
        console.log(res.private);
    }
})();
