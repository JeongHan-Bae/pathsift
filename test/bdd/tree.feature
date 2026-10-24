Feature: tree command
  Scenario Outline: tree respects ignore and parent combinations
    Given an isolated directory with <ignore files> ignore files
    And the global ignore rule is <global>
    And the parent mode is <parent>
    And empty parent accepts "", bare --parent, --parent --, and --parent before --force
    When I run tree with <flags> and <parent>
    Then I receive a branch drawing and totals

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
    When I run tree without --force
    Then stderr explains the required option and the command fails
    When I run tree with --force
    Then the command succeeds

  Scenario: Draw a target with ancestor ignore scopes
    Given a target below two ancestor ignore files
    When I run tree without --parent, with its ancestor, and with an empty --parent from that ancestor
    Then each drawing contains exactly the selected visible files
    And invalid parent paths fail on stderr

  Scenario: Interactive tree output
    When I run tree on a TTY
    Then Ink renders the visible branches

  Scenario: Directories precede files at every level
    Given multiple directories and files created in mixed name order
    When I run tree
    Then each level lists name-sorted directories first and name-sorted files afterward
