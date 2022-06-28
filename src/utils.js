/**
 *
 * @param {...string} elements
 */
module.exports.joinPropPaths = function(...elements) {
    // we do it manually instead og using filter and Array.join(), this is faster
    let result = '';
    for (let element of elements) {
        if (element.length === 0) {
            continue;
        }
        if (result.length > 0) {
            if (element.startsWith('[')) {
                result += element;
            } else {
                result += '.' + element;
            }
        } else {
            result = element;
        }
    }
    return result;
};

/**
 * @param {string} fullPath the full path
 * @param {string} path the path to get the parent for
 * @returns {string}
 */
module.exports.getParentPath = function(fullPath) {
    let lastDot = fullPath.lastIndexOf('.');
    if (lastDot === -1) {
        return "";
    }
    return fullPath.substring(0, lastDot);
};
