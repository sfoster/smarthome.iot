// BuzzyPixel Service UUIDs
var BLE_BUZZ_PIXEL_SERVICE = '0318e986-54b5-11e6-beb8-9e71128cae77';
var PUSH_COLOR_STATUS = '0318ef80-54b5-11e6-beb8-9e71128cae77';
var READ_DEVICE_STATUS = '0318f084-54b5-11e6-beb8-9e71128cae77';

var app = {
    initialize: function() {
        this.bind();
    },

    bind: function() {
        document.addEventListener('deviceready', this.deviceready, false);
        statusScreen.hidden = true;
    },

    deviceready: function() {
        // wire buttons to functions
        deviceList.ontouchstart = app.connect;
        refreshButton.ontouchstart = app.scan;
        disconnectButton.ontouchstart = app.disconnect;
        updateButton.ontouchstart = app.updateStatusOnDevice;
        app.scan();
    },

    scan: function(e) {
        deviceList.innerHTML = ""; // clear the list
        app.setStatus("Scanning for Bluetooth Devices...");

        ble.startScan([BLE_BUZZ_PIXEL_SERVICE],
            app.onDeviceDiscovered,
            function() { app.setStatus("Listing Bluetooth Devices Failed"); }
        );
        // stop scan after 10 seconds
        setTimeout(ble.stopScan, 10000, app.onScanComplete);
    },

    onDeviceDiscovered: function(device) {
        var listItem, rssi;

        console.log(JSON.stringify(device));
        listItem = document.createElement('li');
        listItem.dataset.deviceId = device.id;
        if (device.rssi) {
            rssi = "RSSI: " + device.rssi + "<br/>";
        } else {
            rssi = "";
        }
        listItem.innerHTML = device.name + "<br/>" + rssi + device.id;
        deviceList.appendChild(listItem);

        var deviceListLength = deviceList.getElementsByTagName('li').length;
        app.setStatus("Found " + deviceListLength + 
                      " device" + (deviceListLength === 1 ? "." : "s."));
    },

    onScanComplete: function() {
        var deviceListLength = deviceList.getElementsByTagName('li').length;
        if (deviceListLength === 0) {
            app.setStatus("No Bluetooth Peripherals Discovered.");
        }
    },

    connect: function (e) {
        app.setStatus("Connecting...");
        var deviceId = e.target.dataset.deviceId;
        console.log("Requesting connection to " + deviceId);
        ble.connect(deviceId, app.onConnect, app.onDisconnect);
    },

    disconnect: function(event) {
        app.setStatus("Disconnecting...");
        ble.disconnect(app.connectedPeripheral.id,
            function() {
                stopPolling();
                connectionScreen.hidden = false;
                statusScreen.hidden = true;
                app.setStatus("Disconnected");
                setTimeout(app.scan, 1000);
            });
    },

    onConnect: function(peripheral) {
        console.log("BLEBuzzy peripheral");
        console.log(JSON.stringify(peripheral, null, 2));
        app.connectedPeripheral = peripheral;
        connectionScreen.hidden = true;
        statusScreen.hidden = false;
        app.setStatus("Connected.");
        app.syncUI();
        resetPolling();

        ble.startNotification(peripheral.id, BLE_BUZZ_PIXEL_SERVICE, READ_DEVICE_STATUS, app.onData,
        function(error) {
            console.log('Buzzy-pixel Error reading characteristic');
            console.log(error);
            app.setStatus("Error reading characteristic " + error);
        });
    },

    onData: function(buffer) {
        var data = new Uint8Array(buffer);
        var homeSlot = 'status' + selfLED;
        homeSlot.value = data[0];
        readStatusText.innerText = data[0];
        // Update self status in cloud
        var status = data[0] ? 1 : 0;
        postNewStatus(baseURL + selfURL, status);
    },

    onDisconnect: function(reason) {
        if (!reason) {
            reason = "Connection Lost";
        }
        stopPolling();
        connectionScreen.hidden = false;
        statusScreen.hidden = true;
        app.setStatus(JSON.stringify(reason));
        console.log("BLE Buzzy Pixel unexpected disconnect");
        console.log(JSON.stringify(reason));
    },

    syncUI: function() {
        // read values from BLE device and update the phone UI and pass updated status to cloud
        var id = app.connectedPeripheral.id;
        ble.read(id, BLE_BUZZ_PIXEL_SERVICE, READ_DEVICE_STATUS, app.onData,
        function(error) {
            console.log('Buzzy-pixel error reading characteristic on synch');
            console.log(error);
            app.setStatus("Error reading characteristic on synch " + error);
        });
    },

    // Handle Status update from App Update button click
    updateStatusOnDevice: function (evt) {
        var value = new Uint8Array(ledLength);
        for (var i in value) {
          value[i] = window['status' + i].value;
        }
        app.sendStatusToBLENano(value);
    },

    sendStatusToBLENano: function(arStatus) {
        ble.write(app.connectedPeripheral.id, BLE_BUZZ_PIXEL_SERVICE, PUSH_COLOR_STATUS, arStatus.buffer,
            function() {
                for (var i in arStatus) {
                  window['status' + i].value = arStatus[i];
                }
            },
            function(error) {
                console.log('Buzzy-pixel Error setting characteristi');
                console.log(error);
                app.setStatus("Error setting characteristic " + error);
            }
        );
        setTimeout(ble.read(app.connectedPeripheral.id, BLE_BUZZ_PIXEL_SERVICE, PUSH_COLOR_STATUS, function(buffer) {
          var data = new Uint8Array(buffer);
          console.log('Buzzy-pixel updated status on device to');
          for (var i in data) {
            console.log(data[i]);
          }
        },
        function(error) {
            console.log('Buzzy-pixel error reading characteristic after set status');
            console.log(error);
            app.setStatus("Error reading characteristic after set status " + error);
        }), 1000);
    },
    
    timeoutId: 0,
    
    setStatus: function(status) {
        if (app.timeoutId) {
            clearTimeout(app.timeoutId);
        }
        messageDiv.innerText = status;
        app.timeoutId = setTimeout(function() { messageDiv.innerText = ""; }, 14000);
    }
};

app.initialize();
