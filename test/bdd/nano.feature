Feature: nano command
  Scenario: Reject a noninteractive terminal
    When I run nano without a TTY
    Then stderr reports the TTY requirement and global.ignore is unchanged

  Scenario: Save an edit in an isolated package
    When I edit and save through a pseudoterminal
    Then global.ignore contains the new rule

  Scenario: Discard an edit in an isolated package
    When I edit and confirm discard through a pseudoterminal
    Then global.ignore is unchanged

  Scenario: Reject a positional argument
    When I run nano with an extra path
    Then stderr reports an argument error

  Scenario: Reject a scan option
    When I run nano with --force or --parent with or without an empty value
    Then stderr reports that the option is unsupported without opening the editor
