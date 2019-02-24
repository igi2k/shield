# Shield
Authentication shield for web apps

## Configuration
Configuration is read form `config/config.json`.

### `apps`
Define routing or application modules.
- **routing (proxy)**
```
    {
      "name": "Application",
      "path": "app",
      "alias": "/test/app"
      "url": "http://localhost:8080"
    }
```
- **application module**
```
    {
      "name": "Application",
      "path": "app",
      "module": "app-module",
      "config": {
        "compress": true
      }
    }
```

### `hostname`
Setting to limit listening interfaces.

### `port`
Custom listening port, default is `8080`.

### `tls`
Enables `https` module by specifying certificate/key pair in `pem` format.
- `key` - private key
- `cert` - public certificate
- `ca` - certificate issuing authority

### `sso`
Enables third party authentication through json web tokens.
- `url` - handshake server
- `cert` - server certificate in `pem` format

### `logging`
Customization of logging output.
- `module` - module with logging customization function
```
async (morgan, executeSync, config) => {}
```
- `config` - custom module config (optional)