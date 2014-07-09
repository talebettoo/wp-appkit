<?php

class WpakWebServiceSynchronization {

	public static function hooks() {
		add_filter( 'wpak_read_synchronization', array( __CLASS__, 'read' ), 10, 3 );
	}

	public static function read( $service_answer, $query_vars, $app_id ) {
		$service_answer = array();

		$app_id = WpakApps::get_app_id( $app_id );

		$service_answer = WpakComponents::get_components_synchro_data( $app_id );
		$service_answer['options'] = WpakOptions::get_app_options( $app_id, WpakOptions::dynamic_type );

		return ( object ) $service_answer;
	}

}

WpakWebServiceSynchronization::hooks();
