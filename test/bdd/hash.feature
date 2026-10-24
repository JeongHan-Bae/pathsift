Feature: hash command
  Scenario Outline: hash respects ignore and parent combinations
    Given an isolated directory with <ignore files> ignore files
    And the global ignore rule is <global>
    And the parent mode is <parent>
    And empty parent accepts "", bare --parent, --parent --, and --parent before --force
    When I run hash with <flags> and <parent>
    Then I receive SHA-256 lines for regular files and a tree-sha256 summary

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
    When I run hash without --force
    Then stderr explains the required option and the command fails
    When I run hash with --force
    Then the command succeeds

  Scenario: Hash target-relative files with ancestor ignore scopes
    Given a target below two ancestor ignore files
    When I run hash without --parent, with its ancestor, and with an empty --parent from that ancestor
    Then file names remain relative to the target and each tree digest reflects the selected files
    And invalid parent paths fail on stderr

  Scenario: Rename a visible file without changing its content
    When I hash the tree and rename a visible file
    Then the content digest stays the same while file-sha256 and tree-sha256 change

  Scenario: Move bytes between file boundaries
    When I move the tail byte of one file to the head of another
    Then the concatenated bytes stay the same and tree-sha256 changes

  Scenario: Move all bytes from the later file into the first file
    When I prepend the later file's bytes to the first and empty the later file
    Then tree-sha256 changes

  Scenario: Move a first-sorted file out of its folder
    When I move a file from a folder to the root while it remains first in sort order
    Then tree-sha256 changes because its relative filename changed

  Scenario: Equal bytes under different filenames
    When two visible files contain identical bytes but have different names
    Then their file-sha256 values differ

  Scenario: An ignored file changes
    When I change the bytes of a file excluded by the selected rules
    Then tree-sha256 stays the same because the file is outside the visible set

  Scenario: Move b from dir_1 to the root
    Given a and dir_1 containing b, c, and d
    When I move b to the root without editing its bytes
    Then b's file-sha256 and tree-sha256 differ from before

  Scenario: Relocate the entire scan root
    Given the same visible relative files under directory a
    When I move the complete scan root to b without changing its contents
    Then every file-sha256 and tree-sha256 stays the same

  Scenario: The command's directory argument defines the hash base
    Given one file below a nested directory
    When I hash the outer directory and then the nested directory with the same CLI executable
    Then the file's relative name and tree-sha256 differ
    And `hash a/` from `x/` matches `hash ./` from `x/a/` exactly
