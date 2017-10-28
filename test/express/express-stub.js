class LoggerMock {

    constructor() {
        this.errors = [];
    }
    
    containsError(message) {
        return !!this.errors.find((error) => {
            if(error instanceof Error) {
                return error.message === message;
            }
            return false;
        });
    }

    get logger() {
        return {
            error: (error) => {
                this.errors.push(error);
            }
        };
    }
}

module.exports = {
    
    LoggerMock,

    appStub: {
        keys: {
            password: "secret-password",
            cookie: "secret-cookie"
        },
        locals: {
            users: {
                "test": {
                    "key": "WgnRQlohr6EOVWFy/8+sFJuaLmoiO9rqHz8QKTWbPGj9Z0oNzH1GGR89JmxFuedspJ8cfHffRPUK+6QuRelrqLsvWkKYws4rhscmurzko0o2mHycmjJCtKLA8p9ei94o"
                }
            }
        },
        logger: {
            error: () => {}
        }
    },

    ipAddress: "192.168.5.20",
    
    credentials: {
        name: "test",
        pass: "test"
    },

    responseStub: {
        setHeader: () => {},
        status: () => {},
        cookie: () => {},
        clearCookie: () => {},
        locals: {}
    }
};