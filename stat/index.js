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
        if (argv[i].startsWith('--'))
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

const getEntityType = IStat => {
    return IStat.isDirectory()
        ? 'directory'
        : IStat.isBlockDevice()
        ? 'block_device'
        : IStat.isCharacterDevice()
        ? 'character_device'
        : IStat.isFIFO()
        ? 'fifo'
        : IStat.isSocket()
        ? 'socket'
        : IStat.isSymbolicLink()
        ? 'symlink'
        : IStat.isFile()
        ? 'file'
        : 'unknown';
};

const permissionStringFromStats = IStat => {
    const st_mode = IStat.mode & parseInt('777', 8);
    // Define the file type flags
    const S_IFMT = 0o170000; // bit mask for the file type bit fields
    const S_IFSOCK = 0o140000; // socket
    const S_IFLNK = 0o120000; // symbolic link
    const S_IFREG = 0o100000; // regular file
    const S_IFBLK = 0o060000; // block device
    const S_IFDIR = 0o040000; // directory
    const S_IFCHR = 0o020000; // character device
    const S_IFIFO = 0o010000; // FIFO
    // Define the permission flags
    const S_ISUID = 0o4000; // set UID bit
    const S_ISGID = 0o2000; // set-group-ID bit
    const S_ISVTX = 0o1000; // sticky bit
    const S_IRWXU = 0o0700; // owner permissions
    const S_IRUSR = 0o0400; // owner has read permission
    const S_IWUSR = 0o0200; // owner has write permission
    const S_IXUSR = 0o0100; // owner has execute permission
    const S_IRWXG = 0o0070; // group permissions
    const S_IRGRP = 0o0040; // group has read permission
    const S_IWGRP = 0o0020; // group has write permission
    const S_IXGRP = 0o0010; // group has execute permission
    const S_IRWXO = 0o0007; // others' permissions
    const S_IROTH = 0o0004; // others have read permission
    const S_IWOTH = 0o0002; // others have write permission
    const S_IXOTH = 0o0001; // others have execute permission
    // Determine file type
    let type = '';
    switch (st_mode & S_IFMT) {
        case S_IFSOCK:
            type = 's';
            break; // socket
        case S_IFLNK:
            type = 'l';
            break; // symbolic link
        case S_IFREG:
            type = '-';
            break; // regular file
        case S_IFBLK:
            type = 'b';
            break; // block device
        case S_IFDIR:
            type = 'd';
            break; // directory
        case S_IFCHR:
            type = 'c';
            break; // character device
        case S_IFIFO:
            type = 'p';
            break; // FIFO
        default: // if number not recognized (like in Windows), parse with the other way
            type = IStat.isSocket()
                ? 's'
                : IStat.isSymbolicLink()
                ? 'l'
                : IStat.isFile()
                ? '-'
                : IStat.isBlockDevice()
                ? 'b'
                : IStat.isDirectory()
                ? 'd'
                : IStat.isCharacterDevice()
                ? 'c'
                : IStat.isFIFO()
                ? 'p'
                : '?';
            break;
    }
    // Determine permissions
    const owner =
        (st_mode & S_IRUSR ? 'r' : '-') +
        (st_mode & S_IWUSR ? 'w' : '-') +
        (st_mode & S_IXUSR
            ? st_mode & S_ISUID
                ? 's'
                : 'x'
            : st_mode & S_ISUID
            ? 'S'
            : '-');
    const group =
        (st_mode & S_IRGRP ? 'r' : '-') +
        (st_mode & S_IWGRP ? 'w' : '-') +
        (st_mode & S_IXGRP
            ? st_mode & S_ISGID
                ? 's'
                : 'x'
            : st_mode & S_ISGID
            ? 'S'
            : '-');
    const others =
        (st_mode & S_IROTH ? 'r' : '-') +
        (st_mode & S_IWOTH ? 'w' : '-') +
        (st_mode & S_IXOTH
            ? st_mode & S_ISVTX
                ? 't'
                : 'x'
            : st_mode & S_ISVTX
            ? 'T'
            : '-');
    // Combine type and permissions into a string
    return type + owner + group + others;
};

const getPermissionOctal = IStat => {
    return '0' + (IStat.mode & parseInt('777', 8)).toString(8);
};

const getDateFormatted = dateMs => {
    return new Date(dateMs).toISOString();
};

/**
 * @param {string} layout The layout string to format.
 * @param {string} filePath The absolute item path.
 * @param {fs.Stats} IStat The fs.Stats object for that item path.
 * @returns
 */
function render(layout, IStat, filePath) {
    for (let prop in PROPERTIES)
        layout = layout
            .replaceAll('%' + prop, PROPERTIES[prop](IStat, filePath))
            .replaceAll('\\n', '\n')
            .replaceAll('\\t', '\t');
    return layout;
}

const PROPERTIES = {
    // Device code
    d: IStat => IStat.dev,
    // Device code (in hex)
    D: IStat => IStat.dev.toString(16),
    // Alt device code
    r: IStat => IStat.rdev,
    // Number of links
    h: IStat => IStat.nlink,
    // UserID (unix-only)
    u: IStat => IStat.uid,
    // GroupID (unix-only)
    g: IStat => IStat.gid,
    // Block Size
    B: IStat => IStat.blksize,
    // INode
    i: IStat => IStat.ino,
    // Size in bytes
    s: IStat => IStat.size,
    // Number of blocks used
    b: IStat => IStat.blocks,
    // Creation time (human-readable)
    w: IStat => getDateFormatted(IStat.birthtimeMs),
    // Creation time (milisseconds since epoch)
    W: IStat => Math.trunc(IStat.birthtimeMs),
    // Access time (human-readable)
    x: IStat => getDateFormatted(IStat.atimeMs),
    // Access time (milisseconds since epoch)
    X: IStat => Math.trunc(IStat.atimeMs),
    // Modify time (human-readable)
    y: IStat => getDateFormatted(IStat.mtimeMs),
    // Modify time (milisseconds since epoch)
    Y: IStat => Math.trunc(IStat.mtimeMs),
    // Change time (human-readable)
    z: IStat => getDateFormatted(IStat.ctimeMs),
    // Change time(milisseconds since epoch)
    Z: IStat => Math.trunc(IStat.ctimeMs),
    // Permissions (in numeric format - hex)
    f: IStat => parseInt(getPermissionOctal(IStat), 8).toString(16),
    // Permissions (in numeric format - octal)
    a: IStat => getPermissionOctal(IStat),
    // Permissions (human-readable format)
    A: IStat => permissionStringFromStats(IStat),
    // Item type (directory, file, FIFO, ...)
    F: IStat => getEntityType(IStat),
    // Item name
    n: (IStat, fpath) => path.basename(fpath),
    // Item path
    p: (IStat, fpath) => fpath,
};

const DEFAULT_TEXT_LAYOUT =
    `File  : %n \n` +
    `Path  : %p \n` +
    `Size  : %s \n` +
    `Type  : %F \n` +
    `Blocks: %b \n` +
    `B.Size: %B \n` +
    `Device: %d %r \n` +
    `Inode : %i \n` +
    `Links : %h \n` +
    `Perm. : %a %A \n` +
    `Uid   : %u \n` +
    `Gid   : %g \n` +
    `Access: %x \n` +
    `Modify: %y \n` +
    `Change: %z \n` +
    `Birth : %w`;

// Options with dashes are not supported by the implementation
const DEFAULT_TERSE_LAYOUT = '%n %s %b %f %u %g %d %i %h - - %X %Y %Z %W %B -';

const DEFAULT_JSON_LAYOUT =
    '{\n' +
    `    "file": "%n", \n` +
    `    "path": "%p", \n` +
    `    "size": "%s", \n` +
    `    "type": "%F", \n` +
    `    "blocks": "%b", \n` +
    `    "blockSize": "%B", \n` +
    `    "device": ["%d", "%r"], \n` +
    `    "inode": "%i", \n` +
    `    "links": "%h", \n` +
    `    "permissions": ["%a", "%A"], \n` +
    `    "uid": "%u", \n` +
    `    "gid": "%g", \n` +
    `    "access": "%x", \n` +
    `    "modify": "%y", \n` +
    `    "change": "%z", \n` +
    `    "birth": "%w" \n` +
    '}';

const help = `
    [stat-js]
        Retrieve information about a file system entity.
        Corresponds to the "stat" unix utility.

    Usage:
        node stat <path> [options]

    Options:
        -h | --help         Prints the help message and quits.
        -v | --version      Prints the version info and quits.
        -H | --longhelp     Prints the complete help message and quits.
        -f | --format S     Formats the output according to the available properties.
        -j | --json         Prints all data as a JSON object.
        -t | --terse        Prints data in compact one-line format.`;

const longhelp = `
    [stat-js]
        Retrieve information about a file system entity.
        Corresponds to the "stat" unix utility.

    Usage:
        node stat <path> [options]

    Options:
        -h | --help         Prints the help message and quits.
        -v | --version      Prints the version info and quits.
        -H | --longhelp     Prints the complete help message and quits.
        -p | --printf S     Formats the output according to the available properties.
        -j | --json         Prints all data as a JSON object.
        -t | --terse        Prints data in compact one-line format.

    Properties:
        %d    Device code       
        %D    Device code (hexadecimal)      
        %r    Alt device code       
        %h    Number of links       
        %u    UserID   
        %g    GroupID     
        %B    Block Size       
        %i    INode       
        %s    Size in bytes       
        %b    Number of blocks used       
        %w    Creation time (human-readable format)       
        %W    Creation time (milisseconds since epoch)       
        %x    Access time (human-readable format)       
        %X    Access time (milisseconds since epoch)       
        %y    Modify time (human-readable format)       
        %Y    Modify time (milisseconds since epoch)       
        %z    Change time (human-readable format)  
        %Z    Change time (milisseconds since epoch)    
        %f    Permissions (hexadecimal)       
        %a    Permissions (octal)       
        %A    Permissions (human-readable format)  
        %F    Item type
        %n    Item name
        %p    Item path
        
    Default Terse Layout:**
        "%n %s %b %f %u %g %d %i %h - - %X %Y %Z %W %B -" 

        ** The tool does not implement all the unix 'stat' flags
           so, in order to maintain compatibility, unsupported flags
           are replaced with '-'.`;

const fs = require('node:fs');
const path = require('node:path');

const exeresolve = fname => {
    const [m0, m1] = fname.replaceAll('\\', '/').split('/');
    return __dirname.endsWith(m0)
        ? __dirname + '/' + m1
        : __dirname + '/' + fname;
};

function printVersion() {
    try {
        console.log(require(exeresolve('stat/package.json')).version);
    } catch (err) {
        console.log('Error: could not read package descriptor.');
    }
}

(function () {
    const argv = parseArgv({
        h: 'help',
        v: 'version',
        H: 'longhelp',
        f: 'format',
        t: 'terse',
        j: 'json',
    });
    let filepath = process.argv.slice(2)[0];

    if (argv.help || !filepath) return console.log(help);
    if (argv.version) return printVersion();

    if (argv.longhelp) return console.log(longhelp);

    filepath = path.resolve(filepath);

    if (!fs.existsSync(filepath))
        return console.log('Error: invalid file path provided:', filepath);

    if (argv.format && typeof argv.format !== 'string')
        return console.log(
            'Error: invalid format parameter provided. Received:',
            typeof argv.format
        );

    let stats;
    try {
        stats = fs.statSync(filepath);
    } catch (err) {
        return console.log('Error: could not get file stats -', err.message);
    }

    // If the filepath is in Windows, it will use backslashes, that can
    // be interpreted as special char sequences.
    // So, we replace them with unix forward slashes, for safety
    filepath = filepath.replaceAll(/\\/gi, '/');

    if (argv.terse)
        return console.log(render(DEFAULT_TERSE_LAYOUT, stats, filepath));

    if (argv.json)
        return console.log(render(DEFAULT_JSON_LAYOUT, stats, filepath));

    if (argv.format) return console.log(render(argv.format, stats, filepath));

    return console.log(render(DEFAULT_TEXT_LAYOUT, stats, filepath));
})();
