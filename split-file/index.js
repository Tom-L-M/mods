// file splitter
// pass a file A and a size B
// create dir C as A_fragmented
// split A in chunks of size B and save as files in C

// file merger
// pass a list of files or a directory
// if a dir is passed, merges all files of the dir into a file 'A_merged' with extension equal to first file extension in dir
//  the merging order is the default file order from dir listing (alphabetic)
// if files are passed, they will be merged as 'first_file_name + "merged" + fisrt_file_extension'
// the merging order is the passed order (ex: passing -f fileA -f fileB will result in fileA+fileB)

// splitter -m/--merge -f ./dir
// splitter -m/--merge -f file1 [...-f file2]

// splitter -s/--split -f <FileToSplit> -b <blockSize>

// Default size for splitting is 1024 bytes (1kb)
const closeStreamSync = IStream =>
    new Promise(resolve => IStream.once('close', resolve).close());
const getExtension = fname =>
    fname.lastIndexOf('.') < 0 ? '' : fname.slice(fname.lastIndexOf('.'));
const removeExtension = fname =>
    fname.slice(
        0,
        fname.lastIndexOf('.') > 0 ? fname.lastIndexOf('.') : undefined
    );
const getLastPart = fname =>
    fname.replaceAll('\\', '/').includes('/')
        ? fname.slice(fname.replaceAll('\\', '/').indexOf('/') + 1)
        : fname;
const buildFName = (fname, i) =>
    removeExtension(fname) + '_' + i + getExtension(fname);
const buildWName = fname =>
    getLastPart(removeExtension(fname)).replace('_fragmented', '') +
    '_merged' +
    getExtension(fname);
const parseUnit = (str = '') => {
    if (str.includes('kb')) {
        val = parseInt(str.replace('kb', '')) * 1024;
    } else if (str.includes('mb')) {
        val = parseInt(str.replace('mb', '')) * 1024 * 1024;
    } else if (str.includes('gb')) {
        val = parseInt(str.replace('gb', '')) * 1024 * 1024 * 1024;
    } else {
        val = parseInt(str);
    }
    return val;
};

const fs = require('fs');

const help = `
    [split-file-js]

    Split Files:
        split-file -s <-f FILE> [-b SIZE]

    Merge Files:
        split-file -m <-f FILE/DIR> [... -f FILE/DIR]

    Options:
        -h | --help         Prints the help message and quits.
        -v | --version      Prints the version info and quits.

    Info:
        > The default value for splitting blocks is 1kb.
        > Values for splitting may be passed in bytes or with units (kb, mb, gb).
        > Aliases:
            -s : --split        -m : --merge
            -f : --file         -b : --blocksize

    Example:
        (Merge files from dir)
          split-file -m -f example_dir
        (Merge files from dir and alone)
          split-file -m -f example_dir -f some_file.bin
        (Split file into blocks of 10mb (1024000 bytes))
          split-file -s -f example_file -b 10mb
        (Split file into default blocks of 1024 bytes)
          split-file -s -f example_file`;

const exeresolve = fname => {
    const [m0, m1] = fname.replaceAll('\\', '/').split('/');
    return __dirname.endsWith(m0)
        ? __dirname + '/' + m1
        : __dirname + '/' + fname;
};

function printVersion() {
    try {
        console.log(require(exeresolve('split-file/package.json')).version);
    } catch (err) {
        console.log('Error: could not read package descriptor.');
    }
}

(async function main() {
    const args = process.argv.slice(2);
    if (args.length == 0 || args.includes('-h') || args.includes('--help'))
        return console.log(help);
    if (args.includes('-v') || args.includes('--version'))
        return printVersion();
    const operation = args[0];

    const opts = { files: [], size: 1024 };

    for (let i = 1; i < args.length; i++) {
        let now = args[i];
        let next = args[i + 1];
        if (['-f', '--file'].includes(now) && !!next) {
            opts.files.push(next);
            i += 1;
        } else if (['-b', '--blocksize'].includes(now) && !!next) {
            opts.size = next;
            i += 1;
        } else {
            return console.log('Error: unrecognized parameter [' + now + ']');
        }
    }

    if (['-s', '--split'].includes(operation)) {
        const fileToSplit = opts.files[0];
        if (!fileToSplit || !fs.existsSync(fileToSplit))
            return console.log(
                'Error: Invalid file path for splitting [' +
                    (opts.files[0] || '') +
                    ']'
            );

        const filestats = fs.statSync(fileToSplit);
        const sizeToSplit = parseUnit(opts.size + '');

        if (sizeToSplit >= filestats.size)
            return console.log(
                'Error: Invalid file size for splitting [' +
                    opts.size +
                    '] - Split size is higher than file size'
            );
        if (!sizeToSplit || sizeToSplit < 1)
            return console.log(
                'Error: Invalid file size for splitting [' +
                    opts.size +
                    '] - Value should be higher than 0'
            );

        const ndirname = removeExtension(fileToSplit) + '_fragmented';
        if (!fs.existsSync(ndirname))
            fs.mkdirSync(ndirname, { recursive: true });

        const readstream = fs.createReadStream(fileToSplit, {
            highWaterMark: sizeToSplit,
        });
        let currentFileCounter = -1;
        let currentFile;
        let currentFileStream;

        readstream.on('data', async chunk => {
            currentFile = buildFName(
                ndirname + '/' + fileToSplit,
                ++currentFileCounter
            );
            currentFileStream = fs.createWriteStream(currentFile);
            currentFileStream.write(chunk);
            await closeStreamSync(currentFileStream);
        });
    } else if (['-m', '--merge'].includes(operation)) {
        // splitter -m/--merge -f ./dir
        // splitter -m/--merge -f file1 [...-f file2]
        let tmp = opts.files[0];
        opts.files = opts.files.map(x => (fs.existsSync(x) ? x : null));
        if (opts.files.includes(null) || opts.files.length < 1)
            return console.log('Error: Invalid file provided for merging');
        if (fs.statSync(opts.files[0]).isDirectory()) {
            opts.files[0] = fs
                .readdirSync(opts.files[0])
                .map(x => opts.files[0] + '/' + x);
            opts.files = opts.files.flat();
        }

        const writestream = fs.createWriteStream(buildWName(tmp), {
            flags: 'a',
        });
        for await (let file of opts.files) {
            fs.createReadStream(file).pipe(writestream);
        }
    } else {
        return console.log(
            'Error: Invalid operation selected [' + operation + ']'
        );
    }
})();
