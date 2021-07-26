function nFormatter(num) {
  if (num >= 1000000000000) {
    return (num / 1000000000000).toFixed(1).replace(/\.0$/, '') + 'T';
  }
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B'; // G
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(2).replace(/\.0$/, '') + 'K';
  }
  return num.toFixed(2);
}

window.addEventListener("load", function() {

  localforage.setDriver(localforage.LOCALSTORAGE);

  const state = new KaiState({
    'unit': '$',
    'total_balance': 0,
    'total_deposit': 0,
    'total_withdraw': 0,
  });

  localforage.getItem('__unit__')
  .then((__unit__) => {
    if (!__unit__) {
      __unit__ = '$';
      state.setState('unit', __unit__);
      localforage.setItem('__unit__', __unit__);
    }
    state.setState('unit', __unit__);
  });

  localforage.getItem('__logs__')
  .then((__logs__) => {
    if (!__logs__) {
      localforage.setItem('__logs__', []);
      state.setState('total_balance', 0);
      state.setState('total_deposit', 0);
      state.setState('total_withdraw', 0);
    } else {
      var total_balance = 0;
      var total_deposit = 0;
      var total_withdraw = 0;
      __logs__.forEach((log) => { // log {date, type, value, note} -> type 0(withdraw) 1(deposit)
        if (log.type === 0) {
          total_withdraw += log.value;
        } if (log.type === 1) {
          total_deposit += log.value;
        }
      });
      total_balance = total_deposit - total_withdraw;
      state.setState('total_balance', total_balance);
      state.setState('total_deposit', total_deposit);
      state.setState('total_withdraw', total_withdraw);
    }
  });

  function commitTransaction(date, type, value, note = '') {
    try {
      value = JSON.parse(value);
      if (value <= 0 && !isNaN(value)) {
        return Promise.reject('Amount must greater than 0');
      }
      return localforage.getItem('__logs__')
      .then((__logs__) => {
        var total_balance = 0;
        var total_deposit = 0;
        var total_withdraw = 0;
        __logs__.forEach((log) => { // log {date, type, value, note} -> type 0(withdraw) 1(deposit)
          if (log.type === 0) {
            total_withdraw += log.value;
          } if (log.type === 1) {
            total_deposit += log.value;
          }
        });
        total_balance = total_deposit - total_withdraw;
        if (value > total_balance && type === 0) {
          return Promise.reject('Insufficient balance');
        } else {
          var data = { date: date, type: type, value: value, note: note };
          __logs__.push(data);
          return localforage.setItem('__logs__', __logs__)
          .then(() => {
            total_balance = 0;
            total_deposit = 0;
            total_withdraw = 0;
            __logs__.forEach((log) => { // log {date, type, value, note} -> type 0(withdraw) 1(deposit)
              if (log.type === 0) {
                total_withdraw += log.value;
              } if (log.type === 1) {
                total_deposit += log.value;
              }
            });
            total_balance = total_deposit - total_withdraw;
            state.setState('total_balance', total_balance);
            state.setState('total_deposit', total_deposit);
            state.setState('total_withdraw', total_withdraw);
          });
        }
      })
      .then(() => {
        return Promise.resolve('Transaction done');
      })
      .catch((err) => {
        return Promise.reject(err);
      });
    } catch(e) {
      return Promise.reject('Invalid amount');
    }
  }

  window['commitTransaction'] = commitTransaction; // debug purpose

  const dummy = new Kai({
    name: '_dummy_',
    data: {
      title: '_dummy_'
    },
    verticalNavClass: '.transNav',
    templateUrl: document.location.origin + '/templates/dummy.html',
    mounted: function() {},
    unmounted: function() {},
    methods: {},
    softKeyText: { left: 'L2', center: 'C2', right: 'R2' },
    softKeyListener: {
      left: function() {},
      center: function() {},
      right: function() {}
    },
    dPadNavListener: {
      arrowUp: function() {
        this.navigateListNav(-1);
      },
      arrowDown: function() {
        this.navigateListNav(1);
      }
    }
  });

  const transaction_logs = new Kai({
    name: '_dummy_',
    data: {
      title: '_dummy_',
      begin: new Date().getTime(),
      end: new Date().getTime(),
      logs: [],
      unit: '$',
    },
    verticalNavClass: '.transNav',
    templateUrl: document.location.origin + '/templates/transaction_logs.html',
    mounted: function() {
      this.data.unit = this.$state.getState('unit');
      this.$router.setHeaderTitle('Transaction History(0)');
      this.methods.getTransaction();
    },
    unmounted: function() {},
    methods: {
      getTransaction: function() {
        var begin = new Date(this.data.begin);
        begin.setHours(0);
        begin.setMinutes(0);
        begin.setSeconds(0);
        begin.setMilliseconds(0);
        var end = new Date(this.data.end);
        end.setHours(23);
        end.setMinutes(59);
        end.setSeconds(59);
        end.setMilliseconds(999);
        if (end.getTime() - begin.getTime() > 0) {
          this.verticalNavIndex = -1;
          localforage.getItem('__logs__')
          .then((__logs__) => {
            if (!__logs__) {
              __logs__ = [];
            }
            var logs = [];
            __logs__.forEach((l) => {
              if (l['date'] >= begin.getTime() && l['date'] <= end.getTime()) {
                l['_date'] = new Date(l['date']).toLocaleDateString();
                l['_type'] = l['type'] === 1 ? 'Deposit' : 'Withdraw';
                logs.push(l);
              }
            });
            this.setData({ logs: logs });
            if (logs.length > 0) {
              this.verticalNavIndex = -1;
              this.navigateListNav(1);
            }
            this.$router.setHeaderTitle(`Transaction History(${logs.length})`);
          });
        } else {
          this.$router.setHeaderTitle('Transaction History(0)');
        }
      },
      renderCenterText: function() {
        console.log(this.verticalNavIndex);
        if (this.verticalNavIndex > -1) {
          const selected = this.data.logs[this.verticalNavIndex];
          if (selected && selected['note'].length > 0) {
            this.$router.setSoftKeyCenterText('NOTE');
          } else {
            this.$router.setSoftKeyCenterText('');
          }
        } else {
          this.$router.setSoftKeyCenterText('');
        }
      }
    },
    softKeyText: { left: 'Begin', center: '', right: 'End' },
    softKeyListener: {
      left: function() {
        var d = new Date(this.data.begin);
        this.$router.showDatePicker(d.getFullYear(), d.getMonth() + 1, d.getDate(), (dt) => {
          this.setData({ begin: dt.getTime() });
          this.methods.getTransaction();
        }, this.methods.renderCenterText);
      },
      center: function() {
        const selected = this.data.logs[this.verticalNavIndex];
        if (selected && selected['note'].length > 0) {
          this.$router.showDialog('Note', selected['note'], null, ' ', () => {}, 'Close', () => {}, ' ', null, () => {});
        }
      },
      right: function() {
        var d = new Date(this.data.end);
        this.$router.showDatePicker(d.getFullYear(), d.getMonth() + 1, d.getDate(), (dt) => {
          this.setData({ end: dt.getTime() });
          this.methods.getTransaction();
        }, this.methods.renderCenterText);
      }
    },
    dPadNavListener: {
      arrowUp: function() {
        this.navigateListNav(-1);
        this.methods.renderCenterText();
      },
      arrowDown: function() {
        this.navigateListNav(1);
        this.methods.renderCenterText();
      }
    }
  });

  const commitWithdrawOrDeposit = function($router, type = true) { // true=deposit, false=withdraw
    $router.push(
      new Kai({
        name: 'form',
        data: {
          amount: '',
          note: '',
        },
        verticalNavClass: '.formNav',
        templateUrl: document.location.origin + '/templates/form.html',
        mounted: function() {
          this.$router.setHeaderTitle(`${type ? 'Deposit' : 'Withdraw'}`);
        },
        unmounted: function() {},
        methods: {
          submit: function() {
            commitTransaction(new Date().getTime(), type ? 1 : 0, document.getElementById('amount').value, document.getElementById('note').value.trim())
            .then((success) => {
              $router.showToast(success.toString());
              $router.pop();
            })
            .catch((err) => {
              $router.showToast(err.toString());
            });
          }
        },
        softKeyText: { left: '', center: '', right: '' },
        softKeyListener: {
          left: function() {},
          center: function() {
            const listNav = document.querySelectorAll(this.verticalNavClass);
            if (this.verticalNavIndex > -1) {
              if (listNav[this.verticalNavIndex]) {
                listNav[this.verticalNavIndex].click();
              }
            }
          },
          right: function() {}
        },
        dPadNavListener: {
          arrowUp: function() {
            this.navigateListNav(-1);
          },
          arrowDown: function() {
            this.navigateListNav(1);
          }
        }
      })
    );
  }

  const home = new Kai({
    name: 'home',
    data: {
      title: 'home',
      unit: '$',
      total_balance: 0,
      _total_balance: 0,
      total_deposit: 0,
      _total_deposit: 0,
      total_withdraw: 0,
      _total_withdraw: 0,
    },
    components: [],
    templateUrl: document.location.origin + '/templates/home.html',
    mounted: function() {
      this.$router.setHeaderTitle('Pocket ATM');
      this.$state.addGlobalListener(this.methods.listenState);
      this.setData({
        'unit': this.$state.getState('unit'),
        'total_balance': nFormatter(this.$state.getState('total_balance')),
        '_total_balance': this.$state.getState('total_balance').toFixed(2),
        'total_deposit': nFormatter(this.$state.getState('total_deposit')),
        '_total_deposit': this.$state.getState('total_deposit').toFixed(2),
        'total_withdraw': nFormatter(this.$state.getState('total_withdraw')),
        '_total_withdraw': this.$state.getState('total_withdraw').toFixed(2),
      });
    },
    unmounted: function() {
      this.$state.removeGlobalListener(this.methods.listenState);
    },
    methods: {
      listenState: function(k, v) {
        var obj = {};
        try {
          JSON.parse(v);
          obj[k] = nFormatter(v)
          obj[`_${k}`] = v.toFixed(2);
        } catch(e){
          obj[k] = v;
        }
        this.setData(obj);
      },
    },
    softKeyText: { left: 'Deposit', center: 'MENU', right: 'Withdraw' },
    softKeyListener: {
      left: function() {
        commitWithdrawOrDeposit(this.$router, true);
      },
      center: function() {
        var menus = [
          { "text": "Transaction History" },
          { "text": "Currency Unit" },
          { "text": "Exit" },
        ];
        this.$router.showOptionMenu('Menu', menus, 'Select', (selected) => {
          if (selected.text === 'Currency Unit') {
            const searchDialog = Kai.createDialog('Currency Unit', '<div><input id="currency-input" placeholder="Enter your currency unit" class="kui-input" type="text" /></div>', null, '', undefined, '', undefined, '', undefined, undefined, this.$router);
            searchDialog.mounted = () => {
              setTimeout(() => {
                setTimeout(() => {
                  this.$router.setSoftKeyText('Cancel' , '', 'Update');
                }, 103);
                const UNIT_INPUT = document.getElementById('currency-input');
                if (!UNIT_INPUT) {
                  return;
                }
                UNIT_INPUT.focus();
                UNIT_INPUT.addEventListener('keydown', (evt) => {
                  switch (evt.key) {
                    case 'Backspace':
                    case 'EndCall':
                      if (document.activeElement.value.length === 0) {
                        this.$router.hideBottomSheet();
                        setTimeout(() => {
                          UNIT_INPUT.blur();
                        }, 100);
                      }
                      break
                    case 'SoftRight':
                      this.$router.hideBottomSheet();
                      setTimeout(() => {
                        UNIT_INPUT.blur();
                        this.$state.setState('unit', UNIT_INPUT.value);
                        localforage.setItem('__unit__', UNIT_INPUT.value);
                      }, 100);
                      break
                    case 'SoftLeft':
                      this.$router.hideBottomSheet();
                      setTimeout(() => {
                        UNIT_INPUT.blur();
                      }, 100);
                      break
                  }
                });
              });
            }
            searchDialog.dPadNavListener = {
              arrowUp: function() {
                const UNIT_INPUT = document.getElementById('currency-input');
                UNIT_INPUT.focus();
              },
              arrowDown: function() {
                const UNIT_INPUT = document.getElementById('currency-input');
                UNIT_INPUT.focus();
              }
            }
            this.$router.showBottomSheet(searchDialog);
          } else if (selected.text === 'Exit') {
            window.close();
          } else if (selected.text === 'Transaction History') {
            this.$router.push('transaction_logs');
          }
        });
      },
      right: function() {
        commitWithdrawOrDeposit(this.$router, false);
      }
    },
  });

  const router = new KaiRouter({
    title: 'KaiKit',
    routes: {
      'index' : {
        name: 'home',
        component: home
      },
      'transaction_logs' : {
        name: 'transaction_logs',
        component: transaction_logs
      },
    }
  });

  const app = new Kai({
    name: '_APP_',
    data: {},
    templateUrl: document.location.origin + '/templates/template.html',
    mounted: function() {},
    unmounted: function() {},
    router,
    state
  });

  try {
    app.mount('app');
  } catch(e) {
    console.log(e);
  }
});
