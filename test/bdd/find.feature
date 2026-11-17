Feature: find command
  Scenario Outline: find respects ignore and parent combinations
    Given an isolated directory with <ignore files> ignore files
    And the global ignore rule is <global>
    And the parent mode is <parent>
    And empty parent accepts "", bare --parent, --parent --, and --parent before --force
    When I run find with <flags> and <parent>
    Then I receive every visible relative path

    Examples:
      | ignore files | global | flags | parent |
      | 0 | on | defaults | omitted |
      | 0 | on | defaults | empty |
      | 0 | on | defaults | explicit |
      | 1 | on | defaults | omitted |
      | 1 | on | defaults | empty |
      | 1 | on | defaults | explicit |
      | 2 | on | two --ignore-file options | omitted |
      | 2 | on | two --ignore-file options | empty |
      | 2 | on | two --ignore-file options | explicit |
      | 2 | off | --no-global-ignore | omitted |
      | 2 | off | --no-global-ignore | empty |
      | 2 | off | --no-global-ignore | explicit |
      | 2 | bypassed | --no-ignore | omitted |
      | 2 | bypassed | --no-ignore | empty |
      | 2 | bypassed | --no-ignore | explicit |

  Scenario: Parent-relative paths require force
    Given a relative path containing ..
    When I run find without --force
    Then stderr explains the required option and the command fails
    When I run find with --force
    Then the command succeeds

  Scenario: A .dockerignore name still uses Git-style scopes
    Given root and nested .dockerignore files
    When I select .dockerignore with --ignore-file
    Then the nested file is applied as a Git-style rule

  Scenario: Select ancestor ignore scopes
    Given a target below two ancestor directories with ignore files
    When I run find without --parent
    Then only the target's ignore file applies
    When I use the ancestor path or an empty --parent from that directory
    Then ignore files along the path to the target apply
    And two selected ignore filenames and disabled filtering retain their documented behavior
    And an unrelated parent or parent-relative path without --force fails on stderr
    And a bare --parent at the end, before --, or before another option acts like an empty value

  Scenario: Type and basename Glob filters
    Given visible regular files, a directory, and a symbolic link
    When I use --type and --name
    Then the output is the matching subsequence in walker order

  Scenario: Depth, size, time and combined filters
    Given nested files with known byte sizes and modification times
    When I filter by depth, size, or modification time
    Then only entries satisfying every requested condition appear
    And --max-depth 0 returns no entries

  Scenario: Option terminator and invalid filters
    Given a directory whose name begins with --
    When I run find with -- before that directory
    Then the name is treated as a literal directory
    When I supply invalid or repeated find filters
    Then stdout is empty, stderr explains the error, and the command fails
    And find filters are rejected by other commands

  Scenario: Distinguish source text containing a PDF signature from PDF bytes
    Given a Java source file containing a PDF signature in a string literal
    And a not-pdf.pdf file with pure ASCII bytes, a PDF with non-text bytes, empty, UTF-16, and late-binary files
    When I run find --type text or --type binary
    Then the Java, not-pdf.pdf, empty, and UTF-16 files are text
    And the PDF with non-text bytes and other binary files are binary
    And --type file selects all regular files

  Scenario: Large non-ASCII YAML and Markdown remain text
    Given long UTF-8 YAML and Markdown files whose tail sample begins inside a multibyte character
    When I run find --type text and --type binary
    Then both files appear only in the text results

  Scenario: JSON and JSON Lines are text while JSONB remains binary
    Given JSON, newline-delimited JSON, and binary JSONB sample bytes
    When I run find --type text and --type binary
    Then the JSON documents appear only as text and JSONB only as binary

  Scenario: ZIP content remains binary with a text filename
    Given a ZIP archive stored under a .txt name
    When I run find --type text and --type binary
    Then it appears only in the binary results

  Scenario: Stream matched paths
    Given a scan that finds a matching path before a later entry
    When I run find
    Then the first path is written before the later entry is requested
    And a later scan failure preserves already written stdout and reports a nonzero exit

  Scenario: Temporarily blocked output retains semantic matches
    Given stdout temporarily cannot accept another write
    When I run find with a bounded standard output stager
    Then scanning continues until the stager is full
    And queued matches are serialized and written in order when stdout resumes
