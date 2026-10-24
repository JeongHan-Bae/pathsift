Feature: manifest command
  Scenario Outline: manifest respects ignore and parent combinations
    Given an isolated directory with <ignore files> ignore files
    And the global ignore rule is <global>
    And the parent mode is <parent>
    And empty parent accepts "", bare --parent, --parent --, and --parent before --force
    When I run manifest with <flags> and <parent>
    Then I receive a JSON document with each visible entry

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
    When I run manifest without --force
    Then stderr explains the required option and the command fails
    When I run manifest with --force
    Then the command succeeds

  Scenario: Export JSON with ancestor ignore scopes
    Given a target below two ancestor ignore files
    When I run manifest without --parent, with its ancestor, and with an empty --parent from that ancestor
    Then each JSON manifest contains exactly the selected target-relative entries
    And invalid parent paths fail on stderr

  Scenario: JSON on a TTY
    When I run manifest on a TTY
    Then stdout is still unstyled parseable JSON
