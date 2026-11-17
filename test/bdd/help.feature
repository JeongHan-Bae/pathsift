Feature: help and command dispatch
  Scenario: Equivalent global help forms
    When I run with no command, help, --help, or -h
    Then each prints the same command index and shared scan options
    And tree --help prints only tree help, including after a bare or empty --parent

  Scenario: Invalid command or option
    When I provide an unknown command or malformed option
    Then the CLI reports an error on stderr and exits nonzero

  Scenario: Command-specific find and where help
    When I run find --help
    Then the CLI describes project-oriented Gitignore-aware filtering and its POSIX compatibility boundary
    And it explains basename matching, AND filters, and relative line output
    When I run where --help
    Then the CLI describes its filename matching modes and directory-before-query syntax

  Scenario: Every command has scoped help
    When I request --help or -h for each executable command
    Then each shows only its usage, applicable options, defaults, and examples
    And nano and config omit scan options
    And missing business arguments do not prevent help
    And bare --parent before help preserves help precedence

  Scenario: The option terminator keeps help-looking names literal
    Given files named --help and -h and a directory named --help
    When I place -- before those names
    Then where searches literal filenames and find scans the literal directory
    And bare --parent before -- preserves the literal query

  Scenario: Interactive help
    When I run global or find help on a TTY
    Then Ink styles only command and option syntax as code, leaving descriptions plain
    And narrow layouts place indented descriptions below the syntax
    And redirected help remains plain

  Scenario: Redirected help marks code without ANSI styling
    When I redirect global or find help to a file or pipe
    Then command syntax and inline options use backtick code markers
    And explanation prose has no code markers or ANSI escapes

  Scenario: Reject help arguments and scan options
    When I run help with an extra path, --force, or --parent with or without an empty value
    Then stderr reports an argument or option error
