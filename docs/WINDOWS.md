# Running LANChat on Windows

## Requirements and first launch

Install Node.js 24 or newer with npm. In PowerShell, change to the directory
containing `package.json` and install the locked dependencies:

```powershell
npm ci
.\scripts\start-windows.cmd -Build -Profile peer-a
```

The first install and first Electron launch may download dependencies. Once
installed and built, the app loads local files and uses the local network.
Enter a display name, then choose **Join local network**.

For later launches, no rebuild is necessary unless source files have changed:

```powershell
.\scripts\start-windows.cmd -Profile peer-a
```

The scripts resolve the project relative to their own location, so they also work
from another working directory or a path containing spaces:

```powershell
& 'C:\My Projects\LANChat\scripts\start-windows.cmd' -Profile peer-a
```

`scripts\start-windows.cmd` calls Node.js directly and requires no change to
PowerShell execution policy. With no arguments it opens the `default` profile.
The optional `start-windows.ps1` accepts the same parameters where permitted.
Both wrappers use `start-windows.mjs`. The existing commands also remain available:

```powershell
npm run build
npm start -- --profile peer-a
```

No installer, global package installation or administrator rights are required
by the launcher. Keep the project directory and its installed dependencies together.

## Multiple windows and development

Use a separate terminal and a unique profile for each simulated person:

```powershell
.\scripts\start-windows.cmd -Profile peer-a
.\scripts\start-windows.cmd -Profile peer-b
.\scripts\start-windows.cmd -Profile peer-c
```

Each command keeps its terminal occupied until that app exits. Launching a profile
already in use focuses its existing window. Profiles accept 1–40 ASCII letters,
digits, underscores or hyphens. Choose different display names for testing.

Development mode builds the desktop code and starts Vite:

```powershell
.\scripts\start-windows.cmd -Mode Dev -Profile peer-a
```

`-Build` is for compiled Start mode; do not combine it with `-Mode Dev`.
The launcher preserves the caller's working directory and `ELECTRON_RUN_AS_NODE`
setting, and reports nonzero build/launch exit codes. It does not change network
priority, firewall configuration, or existing chat data.

## Data and identity

By default data is stored under `%APPDATA%\LANChat\<profile>`, including
`lanchat.sqlite` and Electron session files. Updating or moving the source
directory does not move this data. Do not copy an active profile to another
concurrently running device: that duplicates its identity.

For isolated test data, set an absolute directory before launching:

```powershell
$env:LANCHAT_DATA_ROOT = Join-Path $PWD '.local-data'
.\scripts\start-windows.cmd -Profile peer-a
```

Every terminal must use the intended data-root setting. To return to the default
root in the current terminal:

```powershell
Remove-Item Env:LANCHAT_DATA_ROOT -ErrorAction SilentlyContinue
```

Quit the relevant profile before backing up or restoring its complete data
directory. Do not commit local databases or dependency/build directories to Git.

## Discovery and troubleshooting

- **No nearby people:** both devices must be on an IPv4 network that permits
  direct communication and multicast/broadcast discovery. The same Wi-Fi name
  alone does not guarantee this. Guest Wi-Fi, client isolation, VLAN boundaries,
  and VPN routing can prevent discovery.
- **Windows firewall prompt:** allow the app on the trusted private network you
  intend to use. Discovery uses UDP 45878 and multicast 239.255.42.99; TCP and
  LRDT UDP use dynamically assigned ports. Do not disable the whole firewall.
- **UDP unavailable:** choose **Safe** in profile settings to prefer TCP.
  Auto/Custom also support TCP fallback for the message transport. TCP fallback
  does not replace UDP peer discovery.
- **Only one window appears:** use different `-Profile` values.
- **Missing dependencies/build:** run `npm ci`, then launch with `-Build`.
- **Unsupported Node version:** check `node --version`; version 24 or newer is
  required. Reopen the terminal after installing Node.js.

## Verification

```powershell
npm run typecheck
npm test
npm run test:lrdt
npm run build
npm run test:desktop
```

Core tests include real local sockets and child processes, so restricted sandboxes
can affect their results. Desktop tests require a usable Electron desktop session.
Same-computer tests do not establish that a building's network allows communication
between different devices. Test discovery and messages in both directions on the
actual intended network.
