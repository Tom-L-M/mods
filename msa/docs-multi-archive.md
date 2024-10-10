# MultiArchive file format:

<br>

## Info:

The **MultiArchive** format is a file archiving format that aims to be a simple
metadata wrapper for any type of file, wrapping multiple files in a single one
(behaving much like TAR).

The purpose is to take in multiple files, and add a header to each one,
containing metadata about it. This way, wrapping multiple files in one.

> ==IMPORTANT:==
> ALL BINARY FIELDS ARE BIG-ENDIAN

<br>

## MultiArchive Header Structure:

| Offset | Size | Field Name    | Description                         |
| -----: | ---: | ------------- | ----------------------------------- |
|      0 |   16 | MAGIC_STR     | The string "COMPACTARCHIVE02".      |
|     16 |    1 | VERSION_MAJOR | Packing major version.              |
|     17 |    1 | VERSION_MINOR | Packing minor version.              |
|     18 |    4 | FILE_COUNT    | The total count of files.           |
|     22 |   16 | RESERVED      | Reserved bytes for future versions. |
|     38 |      |               |                                     |

<br>

After the header, comes the file entries:

|  Offset | Size | Field Name | Description              |
| ------: | ---: | ---------- | ------------------------ |
|       N |   X1 | File_1     | A SingleArchive instance |
|    N+X1 |   X2 | File_2     | A SingleArchive instance |
| N+X1+X2 |   X3 | File_3     | A SingleArchive instance |
|     ... |   XN | File_N     | A SingleArchive instance |

<br>

Each entry is a **SingleArchive** instance, with its individual header, concatenated.

The number of **SingleArchive** entries equals the "**FILE_COUNT**" header value.

See <_lib-single-archive/docs.txt_> for information on the **SingleArchive** format.

<br>
<br>

---
