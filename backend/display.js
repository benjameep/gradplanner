function display(tree, indent) {
	indent = indent || 0
	var spaces = Array(indent).join(' ')
	console.log(spaces,
		tree.course ? tree.course : (tree.header),
		`(${+tree.credits[0]+(tree.credits[0]!=tree.credits[1]?' - '+tree.credits[1]:'')})`,
		tree.detail ? `[${tree.detail}]` : '')
	if (tree.sub)
		tree.sub.forEach(t => display(t, indent + 4))
}
module.exports = display