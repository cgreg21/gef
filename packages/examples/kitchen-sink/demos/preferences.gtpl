<Flex direction="column" gap="16" margin-top="20">
  <GtkLabel label="Preferences" xalign="0" />
  <GtkLabel label="Control how the extension behaves on your desktop." xalign="0" />
  <Flex direction="row" gap="12">
    <Flex direction="column" gap="4">
      <GtkLabel label="Automatic updates" xalign="0" />
      <GtkLabel label="Install stable updates automatically" xalign="0" />
    </Flex>
    <GtkSwitch active="true" />
  </Flex>
  <GtkSeparator orientation="horizontal" />
  <Flex direction="row" gap="12">
    <Flex direction="column" gap="4">
      <GtkLabel label="Show notifications" xalign="0" />
      <GtkLabel label="Notify when an update is available" xalign="0" />
    </Flex>
    <GtkSwitch active="true" />
  </Flex>
  <GtkCheckButton label="Start with the desktop" active="true" />
  <GtkCheckButton label="Include beta releases" active="false" />
  <GtkSeparator orientation="horizontal" />
  <GtkLabel label="Update frequency" xalign="0" />
  <GtkSpinButton value="6" />
</Flex>