$cases = @(
    @('--target','http://localhost:8080','--port','4000'),
    @('--target','http://localhost:8080'),
    @('--target','https://api.example.com'),
    @('--target','http://localhost:8080','--port','1'),
    @('--target','http://localhost:8080','--port','65535'),
    @(),
    @('--target','http://localhost:8080','--bogus'),
    @('--target','http://localhost:8080','--port','abc'),
    @('--target','http://localhost:8080','--port','0'),
    @('--target','http://localhost:8080','--port','65536'),
    @('--target','http://localhost:8080','--port','40.5'),
    @('--target','http://localhost:8080','--port',''),
    @('--target','localhost:8080'),
    @('--target','ftp://localhost:8080'),
    @('--target','not a url'),
    @('--target','http://localhost:8080/'),          # bare origin with trailing slash -> exit 0
    @('--target','http://localhost:8080/api'),       # -> exit 2
    @('--target','http://localhost:8080?x=1'),       # -> exit 2
    @('--target','http://localhost:8080/#frag'),     # -> exit 2

    # Phase 1 fault flags. All of these are usage errors, so they exit immediately.
    # Valid fault values are checked by reading the proxy.listening line, not here,
    # because a valid run starts the server and blocks.
    # Negative values use the --flag=-1 form: parseArgs rejects a value starting with
    # a dash before the validator ever sees it.
    @('--target','http://localhost:8080','--latency','abc'),        # -> exit 2
    @('--target','http://localhost:8080','--latency=-1'),           # -> exit 2
    @('--target','http://localhost:8080','--latency','1.5'),        # -> exit 2
    @('--target','http://localhost:8080','--latency','400000'),     # -> exit 2
    @('--target','http://localhost:8080','--latency',''),           # -> exit 2
    @('--target','http://localhost:8080','--fail-rate','abc'),      # -> exit 2
    @('--target','http://localhost:8080','--fail-rate','1.5'),      # -> exit 2
    @('--target','http://localhost:8080','--fail-rate=-0.1'),       # -> exit 2
    @('--target','http://localhost:8080','--fail-rate',''),         # -> exit 2
    @('--target','http://localhost:8080','--fail-status','200'),    # -> exit 2
    @('--target','http://localhost:8080','--fail-status','abc'),    # -> exit 2
    @('--target','http://localhost:8080','--fail-status','600'),    # -> exit 2
    @('--target','http://localhost:8080','--fail-status','')        # -> exit 2
)
foreach ($c in $cases){
    Write-Host "--- [$($c -join ' ')]" -ForegroundColor Cyan
    npx tsx src/index.ts @c
    Write-Host "    exit=$LASTEXITCODE"
}
