<?php
return [
    'extends' => 'bootstrap3',
    'css' => [
        'custom.css',
        'datatables.min.css',
        'dataTables.bootstrap.min.css',
    ],
    'js' => [
        'languages.js',
        'format.js',
        'base.js',
        'lib/axios.min.js',
    ],
    'favicon' => 'icons/favicon.ico',
    'helpers' => ['factories' => [
        'VuFind\View\Helper\Root\RecordDataFormatter' => 'Oasisbr\View\Helper\Root\RecordDataFormatterFactory',
    ]],
    'aliases' => [
        'piwik' => 'Oasisbr\View\Helper\Root\Piwik',
    ]

];
