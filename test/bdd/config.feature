Feature: config command
  Scenario: Show installed package configuration
    When I run config
    Then stdout contains the package-local config path, global ignore path, ignore filenames, hash version, and buffer limit

  Scenario: Reject a positional argument
    When I run config with an extra path
    Then stderr reports an argument error and the command fails

  Scenario: Reject a scan option
    When I run config with --no-ignore or --parent with or without an empty value
    Then stderr reports that the option is unsupported

  Scenario: Reject an unknown configured hash version
    Given hashVersion is 2 in the package config
    When I run config
    Then stderr reports that only hashVersion 1 is supported

  Scenario: Reject a config without a hash version
    Given hashVersion is absent from the package config
    When I run config
    Then stderr reports the missing version as unsupported

  Scenario: Reject an invalid buffer limit
    Given bufferLimitBytes is zero in the package config
    When I run config
    Then stderr reports the invalid limit
