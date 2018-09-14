module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        jsdoc : {
            dist : {
                src: ['src/*.js', 'test/*.js', 'README.md'],
                options: {
                    destination : 'doc',
                       template : "node_modules/jsdoc-sphinx/template"
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-jsdoc');
    
    grunt.registerTask('default', []);

    grunt.registerTask('doc', ['jsdoc']);
};