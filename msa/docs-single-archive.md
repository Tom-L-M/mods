# SingleArchive file format:

<br>

## Info:

The Single Archive format is a file archiving format that aims to be a simple metadata wrapper.

It takes in a file and adds a metadata header, followed by the data itself.

Also, can be used as a wrapper for other archiving formats, as it is very similar to the TAR block format
(however not compliant).

> ==IMPORTANT:==
> ALL BINARY FIELDS ARE BIG-ENDIAN

<br>

## File Structure:

|     Offset | Size | Field Name    | Description                                                     |
| ---------: | ---: | ------------- | --------------------------------------------------------------- |
|          0 |   16 | MAGIC_STR     | The string "COMPACTARCHIVE01".                                  |
|         16 |    1 | VERSION_MAJOR | Packing major version.                                          |
|         17 |    1 | VERSION_MINOR | Packing minor version.                                          |
|         18 |   16 | RESERVED      | Reserved bytes for future versions.                             |
|         34 |    8 | FILE_SIZE     | The total file size, including only the data (not the header).  |
|         42 |    4 | FILE_MODE     | The file mode/permissions code, in decimal.                     |
|         46 |    4 | FILE_UID      | The file UID code.                                              |
|         50 |    4 | FILE_GID      | The file GID code.                                              |
|         54 |    1 | FILE_NAMESIZE | The size in bytes of the filename (max 255 chars).              |
|         55 |    N | FILE_NAME     | The filename as a string. The size N is equal to FILE_NAMESIZE. |
|     55 + N |    M | FILE_DATA     | The actual file data. The size M is equal to FILE_SIZE.         |
| 55 + N + M |      |               |                                                                 |

<br>
<br>

---

<br>
<br>

# NodeJS SDK:

> The NodeJS SDK support includes a simple API for creation, listing and extraction.

<br>
<br>

## Creating a SingleArchive file:

`async SingleArchive.create(inputFile: string, { output:? string, internalName:? string }): Promise<SingleArchiveHeader>`

-   **Create a SingleArchive file from an input file "inputFile".**
-   **Returns an instance of a SingleArchiveHeader, containing info about the archived file.**

| Parameter    | Type   | Optional? | Default Value                                   | Description                                                                                                                                                                                                                        |
| ------------ | ------ | :-------: | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| inputFile    | string |    no     | -                                               | The file to read and process the archiving.                                                                                                                                                                                        |
| output       | string |    yes    | "inputFile" parameter <br>with ".sa" extension. | Change the name of the created file. <br>If omitted, the file name will be the basename <br>of "inputFile" with the extension ".sa" appended.                                                                                      |
| internalName | string |    yes    | "inputFile" parameter.                          | Change the name stored in the archive metadata.<br>If omitted, the filename in metadata will be the <br>same as "inputFile".<br>This is the field read during archive extraction, <br>and controls the name of the extracted file. |

#### Examples:

```js
// Creates 'test.sa'
// Sets internal name to 'test.txt'
await SingleArchive.create('./dir/test.txt');
// -> SingleArchiveHeader
// Upon extraction, data will be extracted to "process.cwd()/test.txt"

// Creates 'out.sa'
// Sets internal name to 'test.txt'
await SingleArchive.create('./dir/test.txt', { output: 'out.sa' });
// -> SingleArchiveHeader
// Upon extraction, data will be extracted to "process.cwd()/test.txt"

// Creates 'test.sa'
// Sets internal name to 'samples/s1.txt'
await SingleArchive.create('test.txt', { internalName: 'samples/s1.txt' });
// -> SingleArchiveHeader
// Upon extraction, data will be extracted to "process.cwd()/samples/s1.txt"
// (and missing directories will be created - 'dir' in this case.)
```

<br>
<br>

## Extracting a SingleArchive file:

`async SingleArchive.extract(inputFile: string, { output:? string }): Promise<SingleArchiveHeader>`

-   **Extracts a file from a SingleArchive file "inputFile".**
-   **Returns an instance of a SingleArchiveHeader, containing info about the archived file.**

| Parameter | Type   | Optional? | Default Value                    | Description                                                                                                                        |
| --------- | ------ | :-------: | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| inputFile | string |    no     | -                                | The file to read and process the archive extraction.                                                                               |
| output    | string |    yes    | The value stored in<br>metadata. | Change the path of the extracted file. <br>If omitted, the file name will be the name stored<br>in the metadata as "internalName". |

```js
// Extracts 'test.sa' into 'process.cwd()/out.txt'
// Ignoring internal name
// Upon creation, the internal name was set to default ('test.txt')
await SingleArchive.extract('test.txt', { output: 'out.txt' });
// -> SingleArchiveHeader

// Extracts 'test.sa' into 'process.cwd()/test.txt'
// Using internal name ("test.txt")
// Upon creation, the internal name was set to default ('test.txt')
await SingleArchive.extract('test.sa');
// -> SingleArchiveHeader

// Extracts 'test.sa' into 'process.cwd()/dir/test.txt'
// Using custom internal name ("dir/test.txt")
// Upon creation, the internal name was set to a custom nested one ('dir/test.txt')
// The missing directories (in this case: 'dir') will be created as needed
await SingleArchive.extract('test.sa');
// -> SingleArchiveHeader

// Extracts './somewhere/file.sa' into 'C:\some\dir\sample.txt'
// Ignoring internal name
// Upon creation, the internal name was set to default ('file.txt')
await SingleArchive.extract('./somewhere/file.sa', {
    output: 'C:\\some\\dir\\sample.txt',
});
// -> SingleArchiveHeader
```

<br>
<br>

## Listing a SingleArchive file:

`SingleArchive.list(inputFile: string): SingleArchiveHeader`

-   Returns an instance of a SingleArchiveHeader, containing info about the archived file.

| Parameter | Type   | Optional? | Default Value | Description                                          |
| --------- | ------ | :-------: | ------------- | ---------------------------------------------------- |
| inputFile | string |    no     | -             | The file to read and process the archive extraction. |

```js
// Parses the file header and returns it
SingleArchive.list('sample.sa');
// -> SingleArchiveHeader
```

<br>
<br>

## The SingleArchiveHeader class:

> A class to represent internal state of SingleArchive files.

| Method                             | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<SingleArchiveHeader>.toBuffer()` | A method to convert the current SingleArchiveHeader instance<br>into the corresponding header buffer for a SingleArchive file.<br>Also, a secure method for recreating a header buffer with some specific<br>implementations problems.<br>By calling "new SingleArchiveHeader(buffer).toBuffer()" it is possible<br>to strip trailing bytes, remove invalid fields, and clean reserved space.<br>Also, useful for re-creating the buffer after a internal name (FILE_NAME)<br>modification. |

<br>

| Property                              | Type   | Description                                                                                                                                                                                                             |
| ------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<SingleArchiveHeader>.MAGIC_STR`     | string | The value extracted from the file as in position of the<br>official "MAGIC_STR" value. <br>(It may differ, for custom implementations).                                                                                 |
| `<SingleArchiveHeader>.VERSION_MAJOR` | number | The value for version field (major) that<br>was used during the archiving.                                                                                                                                              |
| `<SingleArchiveHeader>.VERSION_MINOR` | number | The value for version field (minor) that<br>was used during the archiving.                                                                                                                                              |
| `<SingleArchiveHeader>.FILE_SIZE`     | bigint | The file size, in bytes, before archiving. Returned as BigInt.                                                                                                                                                          |
| `<SingleArchiveHeader>.FILE_MODE`     | number | The UNIX file mode/permissions (in DECIMAL base).<br>Usually '438' (0o666) when created in a Windows environment.                                                                                                       |
| `<SingleArchiveHeader>.FILE_UID`      | number | The UNIX file UID.<br>Zero, if the archiving was done in a Windows environment.<br>(As Windows does not support UID value for files).                                                                                   |
| `<SingleArchiveHeader>.FILE_GID`      | number | The UNIX file GID.<br>Zero, if the archiving was done in a Windows environment.<br>(As Windows does not support GID value for files).                                                                                   |
| `<SingleArchiveHeader>.FILE_NAMESIZE` | number | The string length of the file name stored in metadata.<br>This property is avaialble purely for convenience and <br>documentation purposes, and is exactly the same as <br>calling '.length' on the FILE_NAME property. |
| `<SingleArchiveHeader>.FILE_NAME`     | string | The file name stored in the archive metadata.<br>This can be changed in creation or extraction, to control<br>extraction location.                                                                                      |
| `<SingleArchiveHeader>.DATA_OFFSET`   | number | The offset, in bytes, of the first data byte after the header in the<br>archive file. usually useful only for the extractor itself.<br>But kept for convenience and documentation purposes.                             |
