

module.exports.joinPropPaths = function(...elements) {
    elements = elements.filter((element) => element.length > 0);
    return elements.join('.');
};