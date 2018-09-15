/**
 * Functions that are used to calculate the "Auth0-Client" header when logging in.
 * All functions a derived from the how economist.com functions.
 * 
 */
class Auth0FieldEncoder {
    /**
     * @returns {string[]}
     * @static
     */
    static get l() { 
        return Object.freeze(["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z","0","1","2","3","4","5","6","7","8","9","+","/"]); 
    }

    /**
     * @returns {string}
     * @static
     */
    static c(e,t,n) {
        let { l } = Auth0FieldEncoder;
        for (var r, o = [], i = t; i < n; i += 3)
            r = (e[i] << 16 & 16711680) + (e[i + 1] << 8 & 65280) + (255 & e[i + 2]),
            o.push(l[(a = r) >> 18 & 63] + l[a >> 12 & 63] + l[a >> 6 & 63] + l[63 & a]);
        var a;
        return o.join("")
    }

    /**
     * @returns {Function}
     * @static
     */
    static t(e) {
        let { c, l } = Auth0FieldEncoder;
        for (var t, n = e.length, r = n % 3, o = "", i = [], a = 0, s = n - r; a < s; a += 16383)
            i.push(c(e, a, s < a + 16383 ? s : a + 16383));
        return 1 === r ? (t = e[n - 1],
        o += l[t >> 2],
        o += l[t << 4 & 63],
        o += "==") : 2 === r && (t = (e[n - 2] << 8) + e[n - 1],
        o += l[t >> 10],
        o += l[t >> 4 & 63],
        o += l[t << 2 & 63],
        o += "="),
        i.push(o),
        i.join("")
    }

    /**
     * Encodes the value needed for the "Auth0-Client" header.
     * @returns {Object}
     * @static
     */
    static encode (e) {
        let { t } = Auth0FieldEncoder;
        return t(function(e) {
            for (var t = new Array(e.length), n = 0; n < e.length; n++)
                t[n] = e.charCodeAt(n);
            return t
        }(e)).replace(/\+/g, "-").replace(/\//g, "_")
    }
};

/**
 * This module contains the {@link Auth0FieldEncoder} class
 * 
 * @module economist-audio-downloader/Auth0FieldEncoder
 */
module.exports = Auth0FieldEncoder;