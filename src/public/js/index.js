  // 
  // $(document).ready(function() {
  //   $('paper-header-panel#mainPanel').bind('content-scroll', function(e) {
  //     var container = e.originalEvent.detail.target;
  //     console.log(container.scrollTop);
  //     console.log(container.offsetHeight);
  //     console.log(container.scrollHeight);
  //     if (container.scrollTop + container.offsetHeight + 1 >= container.scrollHeight) {
  //       setTimeout(function(){
  //         var page = document.querySelector('table-page');
  //         page.scrollHandler();
  //       },250);
  //     }
  //   });
  // });

  function lift(){
    $('paper-material').attr('elevation','5');
  }

  function expand(){
    $('paper-toolbar').css('height','10em');
    $('paper-material.submenu').addClass("active");
  }

  function insertTest(){
    $('table-page').css('background','orange');
    $.get( "/data", function( response ) {
      $("body").css("--default-primary-color","red");
      $('paper-dialog.submenu paper-dialog-scrollable').text(response);
    });
  }

  function enable(){
    $('paper-fab').attr("disabled", false);

    $.get( "/data", function( response ) {
      $('.inner').text("<p>"+response+"</p>");
    });
  }

  function toggleCollapse(elem){
    var button = elem;
    while (!button.hasAttribute('collapse-id') && button !== document.body) {
      button = button.parentElement;
    }

    if (!button.hasAttribute('collapse-id')) {
      return;
    }

    var id = button.getAttribute('collapse-id');
    var collapse = document.querySelector('iron-collapse.'+id);

    if (collapse) {
      collapse.toggle();
    }
  }
  function changeTheme(){
    var button = document.getElementById('color-schema');
    if(button.checked == true) {
      $('*').removeClass("dark");
      console.log("pressed");
    }
    else {
      $('*').addClass("dark");
    }
  }
  function openDialog(elem){
    var button = elem;
    while (!button.hasAttribute('dialog-id') && button !== document.body) {
      button = button.parentElement;
    }

    if (!button.hasAttribute('dialog-id') || !button.hasAttribute('dialog-class')) {
      return;
    }

    var id = button.getAttribute('dialog-id');
    var className = button.getAttribute('dialog-class');
    var aj = button.getAttribute('ajax');
    var dialog = document.querySelector('paper-dialog.'+className);

    $('paper-dialog.'+className+' .dialog-title').text(id);
    if (typeof aj === 'string')
      $('iron-ajax').attr('url','/'+id);

    if (dialog) {
      dialog.open();
    }
  }
