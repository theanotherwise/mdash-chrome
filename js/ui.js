var ui = {};
;(function (exports) {
    exports.Emitter = Emitter;

    function Emitter() {
        this.callbacks = {};
    };
    Emitter.prototype.on = function (event, fn) {
        (this.callbacks[event] = this.callbacks[event] || [])
            .push(fn);
        return this;
    };
    Emitter.prototype.once = function (event, fn) {
        var self = this;

        function on() {
            self.off(event, on);
            fn.apply(this, arguments);
        }

        this.on(event, on);
        return this;
    };
    Emitter.prototype.off = function (event, fn) {
        var callbacks = this.callbacks[event];
        if (!callbacks) return this;
        if (1 == arguments.length) {
            delete this.callbacks[event];
            return this;
        }
        var i = callbacks.indexOf(fn);
        callbacks.splice(i, 1);
        return this;
    };
    Emitter.prototype.emit = function (event) {
        var args = [].slice.call(arguments, 1)
            , callbacks = this.callbacks[event];
        if (callbacks) {
            for (var i = 0, len = callbacks.length; i < len; ++i) {
                callbacks[i].apply(this, args)
            }
        }
        return this;
    };
})(ui);
;(function (exports, html) {
    var active;
    exports.Dialog = Dialog;
    exports.dialog = function (title, msg) {
        switch (arguments.length) {
            case 2:
                return new Dialog({title: title, message: msg});
            case 1:
                return new Dialog({message: title});
        }
    };

    function Dialog(options) {
        ui.Emitter.call(this);
        options = options || {};
        this.template = html;
        this.el = $(this.template);
        this.render(options);
        if (active) active.hide();
        if (Dialog.effect) this.effect(Dialog.effect);
        active = this;
    };
    Dialog.prototype = new ui.Emitter;
    Dialog.prototype.render = function (options) {
        var el = this.el
            , title = options.title
            , msg = options.message
            , self = this;
        el.find('.close').click(function () {
            self.emit('close');
            self.hide();
            return false;
        });
        el.find('h1').text(title);
        if (!title) el.find('h1').remove();
        if ('string' == typeof msg) {
            el.find('p').text(msg);
        } else if (msg) {
            el.find('p').replaceWith(msg.el || msg);
        }
        setTimeout(function () {
            el.removeClass('hide');
        }, 0);
    };
    Dialog.prototype.closable = function () {
        this.el.addClass('closable');
        return this;
    };
    Dialog.prototype.effect = function (type) {
        this._effect = type;
        this.el.addClass(type);
        return this;
    };
    Dialog.prototype.modal = function () {
        this._overlay = ui.overlay();
        return this;
    };
    Dialog.prototype.overlay = function () {
        var self = this;
        this._overlay = ui
            .overlay({closable: true})
            .on('hide', function () {
                self.closedOverlay = true;
                self.hide();
            });
        return this;
    };
    Dialog.prototype.show = function () {
        this.emit('show');
        if (this._overlay) {
            this._overlay.show();
            this.el.addClass('modal');
        }
        this.el.appendTo('body');
        this.el.css({marginLeft: -(this.el.width() / 2) + 'px'});
        return this;
    };
    Dialog.prototype.hide = function (ms) {
        var self = this;
        this.emit('hide');
        if (ms) {
            setTimeout(function () {
                self.hide();
            }, ms);
            return this;
        }
        this.el.addClass('hide');
        if (this._effect) {
            setTimeout(function (self) {
                self.remove();
            }, 500, this);
        } else {
            self.remove();
        }
        if (this._overlay && !self.closedOverlay) this._overlay.hide();
        return this;
    };
    Dialog.prototype.remove = function () {
        this.el.remove();
        return this;
    };
})(ui, "<div id=\"dialog\" class=\"hide\">\n  <div class=\"content\">\n    <h1>Title</h1>\n    <a href=\"#\" class=\"close\">×</a>\n    <p>Message</p>\n  </div>\n</div>");
;(function (exports, html) {
    exports.Overlay = Overlay;
    exports.overlay = function (options) {
        return new Overlay(options);
    };

    function Overlay(options) {
        ui.Emitter.call(this);
        var self = this;
        options = options || {};
        this.closable = options.closable;
        this.el = $(html);
        this.el.appendTo('body');
        if (this.closable) {
            this.el.click(function () {
                self.hide();
            });
        }
    }

    Overlay.prototype = new ui.Emitter;
    Overlay.prototype.show = function () {
        this.emit('show');
        this.el.removeClass('hide');
        return this;
    };
    Overlay.prototype.hide = function () {
        var self = this;
        this.emit('hide');
        this.el.addClass('hide');
        setTimeout(function () {
            self.el.remove();
        }, 2000);
        return this;
    };
})(ui, "<div id=\"overlay\" class=\"hide\"></div>");
;(function (exports, html) {
    exports.Confirmation = Confirmation;
    exports.confirm = function (title, msg) {
        switch (arguments.length) {
            case 2:
                return new Confirmation({title: title, message: msg});
            case 1:
                return new Confirmation({message: title});
        }
    };

    function Confirmation(options) {
        ui.Dialog.call(this, options);
    };
    Confirmation.prototype = new ui.Dialog;
    Confirmation.prototype.cancel = function (text) {
        this.el.find('.cancel').text(text);
        return this;
    };
    Confirmation.prototype.ok = function (text) {
        this.el.find('.ok').text(text);
        return this;
    };
    Confirmation.prototype.show = function (fn) {
        ui.Dialog.prototype.show.call(this);
        this.callback = fn || function () {
        };
        return this;
    };
    Confirmation.prototype.render = function (options) {
        ui.Dialog.prototype.render.call(this, options);
        var self = this
            , actions = $(html);
        this.el.addClass('confirmation');
        this.el.append(actions);
        this.on('close', function () {
            self.emit('cancel');
            self.callback(false);
        });
        actions.find('.cancel').click(function () {
            self.emit('cancel');
            self.callback(false);
            self.hide();
        });
        actions.find('.ok').click(function () {
            self.emit('ok');
            self.callback(true);
            self.hide();
        });
    };
})(ui, "<div class=\"actions\">\n  <button class=\"cancel\">Cancel</button>\n  <button class=\"ok main\">Ok</button>\n</div>");
;(function (exports, html) {
    exports.ColorPicker = ColorPicker;

    function rgb(r, g, b) {
        return 'rgb(' + r + ', ' + g + ', ' + b + ')';
    }

    function rgba(r, g, b, a) {
        return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + a + ')';
    }

    function ColorPicker() {
        ui.Emitter.call(this);
        this._colorPos = {};
        this.template = html;
        this.el = $(this.template);
        this.main = this.el.find('.main').get(0);
        this.spectrum = this.el.find('.spectrum').get(0);
        $(this.main).bind('selectstart', function (e) {
            e.preventDefault()
        });
        $(this.spectrum).bind('selectstart', function (e) {
            e.preventDefault()
        });
        this.hue(rgb(255, 0, 0));
        this.spectrumEvents();
        this.mainEvents();
        this.w = 180;
        this.h = 180;
        this.render();
    }

    ColorPicker.prototype = new ui.Emitter;
    ColorPicker.prototype.size = function (n) {
        return this
            .width(n)
            .height(n);
    };
    ColorPicker.prototype.width = function (n) {
        this.w = n;
        this.render();
        return this;
    };
    ColorPicker.prototype.height = function (n) {
        this.h = n;
        this.render();
        return this;
    };
    ColorPicker.prototype.spectrumEvents = function () {
        var self = this
            , canvas = $(this.spectrum)
            , down;

        function update(e) {
            var color = self.hueAt(e.offsetY);
            self.hue(color.toString());
            self.emit('change', color);
            self._huePos = e.offsetY;
            self.render();
        }

        canvas.mousedown(function (e) {
            down = true;
            update(e);
        });
        canvas.mousemove(function (e) {
            if (down) update(e);
        });
        canvas.mouseup(function () {
            down = false;
        });
    };
    ColorPicker.prototype.mainEvents = function () {
        var self = this
            , canvas = $(this.main)
            , down;

        function update(e) {
            var color = self.colorAt(e.offsetX, e.offsetY);
            self.color(color.toString());
            self.emit('change', color);
            self._colorPos = e;
            self.render();
        }

        canvas.mousedown(function (e) {
            down = true;
            update(e);
        });
        canvas.mousemove(function (e) {
            if (down) update(e);
        });
        canvas.mouseup(function () {
            down = false;
        });
    };
    ColorPicker.prototype.colorAt = function (x, y) {
        var data = this.main.getContext('2d').getImageData(x, y, 1, 1).data;
        return {
            r: data[0]
            , g: data[1]
            , b: data[2]
            , toString: function () {
                return rgb(this.r, this.g, this.b);
            }
        };
    };
    ColorPicker.prototype.hueAt = function (y) {
        var data = this.spectrum.getContext('2d').getImageData(0, y, 1, 1).data;
        return {
            r: data[0]
            , g: data[1]
            , b: data[2]
            , toString: function () {
                return rgb(this.r, this.g, this.b);
            }
        };
    };
    ColorPicker.prototype.color = function (color) {
        if (0 == arguments.length) return this._color;
        this._color = color;
        return this;
    };
    ColorPicker.prototype.hue = function (color) {
        if (0 == arguments.length) return this._hue;
        this._hue = color;
        return this;
    };
    ColorPicker.prototype.render = function (options) {
        options = options || {};
        this.renderMain(options);
        this.renderSpectrum(options);
    };
    ColorPicker.prototype.renderSpectrum = function (options) {
        var el = this.el
            , canvas = this.spectrum
            , ctx = canvas.getContext('2d')
            , pos = this._huePos
            , w = this.w * .12
            , h = this.h;
        canvas.width = w;
        canvas.height = h;
        var grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, rgb(255, 0, 0));
        grad.addColorStop(.15, rgb(255, 0, 255));
        grad.addColorStop(.33, rgb(0, 0, 255));
        grad.addColorStop(.49, rgb(0, 255, 255));
        grad.addColorStop(.67, rgb(0, 255, 0));
        grad.addColorStop(.84, rgb(255, 255, 0));
        grad.addColorStop(1, rgb(255, 0, 0));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        if (!pos) return;
        ctx.fillStyle = rgba(0, 0, 0, .3);
        ctx.fillRect(0, pos, w, 1);
        ctx.fillStyle = rgba(255, 255, 255, .3);
        ctx.fillRect(0, pos + 1, w, 1);
    };
    ColorPicker.prototype.renderMain = function (options) {
        var el = this.el
            , canvas = this.main
            , ctx = canvas.getContext('2d')
            , w = this.w
            , h = this.h
            , x = (this._colorPos.offsetX || w) + .5
            , y = (this._colorPos.offsetY || 0) + .5;
        canvas.width = w;
        canvas.height = h;
        var grad = ctx.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, rgb(255, 255, 255));
        grad.addColorStop(1, this._hue);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, rgba(255, 255, 255, 0));
        grad.addColorStop(1, rgba(0, 0, 0, 1));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        var rad = 10;
        ctx.save();
        ctx.beginPath();
        ctx.lineWidth = 1;
        ctx.strokeStyle = rgba(0, 0, 0, .5);
        ctx.arc(x, y, rad / 2, 0, Math.PI * 2, false);
        ctx.stroke();
        ctx.strokeStyle = rgba(255, 255, 255, .5);
        ctx.arc(x, y, rad / 2 - 1, 0, Math.PI * 2, false);
        ctx.stroke();
        ctx.beginPath();
        ctx.restore();
    };
})(ui, "<div class=\"color-picker\">\n  <canvas class=\"main\"></canvas>\n  <canvas class=\"spectrum\"></canvas>\n</div>");
;(function (exports, html) {
    var list;
    exports.Notification = Notification;
    $(function () {
        list = $('<ul id="notifications">');
        list.appendTo('body');
    })
    exports.notify = function (title, msg) {
        switch (arguments.length) {
            case 2:
                return new Notification({title: title, message: msg})
                    .show()
                    .hide(4000);
            case 1:
                return new Notification({message: title})
                    .show()
                    .hide(4000);
        }
    };

    function type(type) {
        return function (title, msg) {
            return exports.notify.apply(this, arguments)
                .type(type);
        }
    }

    exports.info = exports.notify;
    exports.warn = type('warn');
    exports.error = type('error');

    function Notification(options) {
        options = options || {};
        this.template = html;
        this.el = $(this.template);
        this.render(options);
        if (Notification.effect) this.effect(Notification.effect);
    };
    Notification.prototype.render = function (options) {
        var el = this.el
            , title = options.title
            , msg = options.message
            , self = this;
        el.find('.close').click(function () {
            self.hide();
            return false;
        });
        el.find('h1').text(title);
        if (!title) el.find('h1').remove();
        if ('string' == typeof msg) {
            el.find('p').text(msg);
        } else if (msg) {
            el.find('p').replaceWith(msg.el || msg);
        }
        setTimeout(function () {
            el.removeClass('hide');
        }, 0);
    };
    Notification.prototype.closable = function () {
        this.el.addClass('closable');
        return this;
    };
    Notification.prototype.effect = function (type) {
        this._effect = type;
        this.el.addClass(type);
        return this;
    };
    Notification.prototype.show = function () {
        this.el.appendTo(list);
        return this;
    };
    Notification.prototype.type = function (type) {
        this._type = type;
        this.el.addClass(type);
        return this;
    };
    Notification.prototype.sticky = function () {
        return this.hide(0).closable();
    };
    Notification.prototype.hide = function (ms) {
        var self = this;
        if ('number' == typeof ms) {
            clearTimeout(this.timer);
            if (!ms) return this;
            this.timer = setTimeout(function () {
                self.hide();
            }, ms);
            return this;
        }
        this.el.addClass('hide');
        if (this._effect) {
            setTimeout(function (self) {
                self.remove();
            }, 500, this);
        } else {
            self.remove();
        }
        return this;
    };
    Notification.prototype.remove = function () {
        this.el.remove();
        return this;
    };
})(ui, "<li class=\"notification hide\">\n  <div class=\"content\">\n    <h1>Title</h1>\n    <a href=\"#\" class=\"close\">×</a>\n    <p>Message</p>\n  </div>\n</li>");
;(function (exports, html) {
    exports.ContextMenu = ContextMenu;
    exports.menu = function () {
        return new ContextMenu;
    };

    function ContextMenu(front, back) {
        var self = this;
        ui.Emitter.call(this);
        this.items = {};
        this.el = $(html).appendTo('body');
        $('html').click(function () {
            self.hide();
        });
    };
    ContextMenu.prototype = new ui.Emitter;
    ContextMenu.prototype.add = function (text, fn) {
        if (1 == arguments.length) return this.items[text];
        var self = this
            , el = $('<li><a href="#">' + text + '</a></li>')
            .addClass(slug(text))
            .appendTo(this.el)
            .click(function (e) {
                e.preventDefault();
                e.stopPropagation();
                self.hide();
                fn();
            });
        this.items[text] = el;
        return this;
    };
    ContextMenu.prototype.remove = function (text) {
        var item = this.items[text];
        if (!item) throw new Error('no menu item named "' + text + '"');
        item.remove();
        delete this.items[text];
        return this;
    };
    ContextMenu.prototype.has = function (text) {
        return !!this.items[text];
    };
    ContextMenu.prototype.moveTo = function (x, y) {
        this.el.css({
            top: y,
            left: x
        });
        return this;
    };
    ContextMenu.prototype.show = function () {
        this.emit('show');
        this.el.show();
        return this;
    };
    ContextMenu.prototype.hide = function () {
        this.emit('hide');
        this.el.hide();
        return this;
    };

    function slug(str) {
        return str
            .toLowerCase()
            .replace(/ +/g, '-')
            .replace(/[^a-z0-9-]/g, '');
    }
})(ui, "<div id=\"context-menu\">\n</div>");
;(function (exports, html) {
    exports.Card = Card;
    exports.card = function (front, back) {
        return new Card(front, back);
    };

    function Card(front, back) {
        ui.Emitter.call(this);
        this._front = front || $('<p>front</p>');
        this._back = back || $('<p>back</p>');
        this.template = html;
        this.render();
    };
    Card.prototype = new ui.Emitter;
    Card.prototype.front = function (val) {
        this._front = val;
        this.render();
        return this;
    };
    Card.prototype.back = function (val) {
        this._back = val;
        this.render();
        return this;
    };
    Card.prototype.flip = function () {
        this.emit('flip');
        this.el.toggleClass('flipped');
        return this;
    };
    Card.prototype.effect = function (type) {
        this.el.addClass(type);
        return this;
    };
    Card.prototype.render = function (options) {
        var self = this
            , el = this.el = $(this.template);
        el.find('.front').empty().append(this._front.el || $(this._front));
        el.find('.back').empty().append(this._back.el || $(this._back));
        el.click(function () {
            self.flip();
        });
    };
})(ui, "<div class=\"card\">\n  <div class=\"wrapper\">\n    <div class=\"face front\">1</div>\n    <div class=\"face back\">2</div>\n  </div>\n</div>");