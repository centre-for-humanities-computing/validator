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
            result += '.' + element;
        } else {
            result = element;
        }
    }
    return result;
};