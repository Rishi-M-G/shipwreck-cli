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
    @('--target','http://localhost:8080/#frag')      # -> exit 2
)
foreach ($c in $cases){
    Write-Host "--- [$($c -join ' ')]" -ForegroundColor Cyan
    npx tsx src/index.ts @c
    Write-Host "    exit=$LASTEXITCODE"
}